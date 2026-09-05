import { ILankaEventMetadata } from "../../_interfaces/ILankaEventMetadata";
import { ILankaEventLog } from "../../_interfaces/ILankaEventLog";
import {
	TLankaEventBusDecision,
	TLankaEventBusMiddleware,
} from "../../_types/TLankaEventBusMiddleware";
import { TLankaEventBusObserver } from "../../_types/TLankaEventBusObserver";
import { ILankaEventBusOutcome } from "../../_interfaces/ILankaEventBusOutcome";
import { lankaLogger } from "../../../logger/lanka-logger/LankaLogger";

/** One subscription: the callback plus everything the bus knows about it. */
type TSubscriptionEntry<T = unknown> = {
	callback: (data: T) => void;
	priority: number;
	/**
	 * How many recent values this subscriber asks to be replayed on subscribe.
	 *
	 * A number rather than a flag: "the whole buffer" can be a hundred events in a
	 * row, which is almost never what "give me the current state" means.
	 */
	replayCount: number;
};

/** State of one registered event type. */
type TEventState = {
	meta: ILankaEventMetadata;
	logs: ILankaEventLog[];
	buffer: unknown[];
	subs: TSubscriptionEntry[];
};

/**
 * How many recent values to replay to a new subscriber.
 *
 * `true` is kept and means "the last one".
 */
export type TLankaReplayRequest = boolean | "last" | number;

function resolveReplayCount(request: TLankaReplayRequest | undefined): number {
	if (request === undefined || request === false) return 0;
	if (request === true || request === "last") return 1;
	return Math.max(0, Math.trunc(request));
}

function maxReplayDepth(subs: readonly TSubscriptionEntry[]): number {
	let depth = 0;
	for (const entry of subs) if (entry.replayCount > depth) depth = entry.replayCount;
	return depth;
}

// -----------------------------------------------------------------------------
// Bus implementation
// -----------------------------------------------------------------------------

export class LankaEventBusInstance {
	/** Event registry and per-event state — private to each instance. */
	private registry: Map<string, TEventState> = new Map();

	/** Middleware registered on this instance. */
	private middlewares: TLankaEventBusMiddleware<unknown>[] = [];

	/**
	 * What is watching the OUTCOME of each dispatch — see `TLankaEventBusObserver`.
	 *
	 * An array rather than a set for one reason: `dispatch` reads `.length` on
	 * every event, and that check is what keeps an unobserved bus paying nothing.
	 */
	private observers: TLankaEventBusObserver[] = [];

	/** Default maximum number of logs kept per event type. */
	private defaultMaxLogs = 100;

	/** Internal timers for replay batching (avoid multiple replays in the same tick). */
	private pendingReplayTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

	/** Whether event logging is enabled. */
	private isEnableLogs = false;

	/**
	 * How many events this bus has logged, ever — the order records are read in.
	 *
	 * Incremented only while logging is on, which is off by default, so a bus
	 * nobody is inspecting pays nothing for it.
	 */
	private dispatchCount = 0;

	// -------------------------------------------------------------------------
	// Configuration
	// -------------------------------------------------------------------------

	/** Configures the bus, e.g. logging. Called once at application start. */
	public enableLogs(): void {
		this.isEnableLogs = true;
	}
	public disableLogs(): void {
		this.isEnableLogs = false;
	}

	// -------------------------------------------------------------------------
	// Internal
	// -------------------------------------------------------------------------

	/**
	 * Ensures the event is registered, registering it if not.
	 *
	 * @param eventType Event type
	 * @param usedBy Who uses it — for the inspector and for finding an owner
	 */
	private ensureEvent(eventType: string, usedBy?: string): TEventState {
		let state = this.registry.get(eventType);
		if (!state) {
			const meta: ILankaEventMetadata = {
				dataType: "any",
				description: `Auto-registered event: ${eventType}`,
				usedBy: usedBy ? [usedBy] : [],
				priority: 0,
				maxLogs: this.defaultMaxLogs,
			};
			state = {
				meta,
				logs: [],
				buffer: [],
				subs: [],
			};
			this.registry.set(eventType, state);
		} else if (usedBy) {
			const meta = state.meta;
			meta.usedBy = [...new Set([...(meta.usedBy ?? []), usedBy])];
		}
		return state;
	}

	// -------------------------------------------------------------------------
	// Public surface
	// -------------------------------------------------------------------------

	/**
	 * Declares an event explicitly, together with its metadata.
	 *
	 * @param eventType Event type
	 * @param metadata What is known about the event and what it is allowed
	 */
	public registerEvent(eventType: string, metadata: ILankaEventMetadata): void {
		// MERGE, never recreate the state.
		//
		// Writing `subs: []` here means a call after anyone subscribed silently
		// drops every subscriber. Bootstrap order (register before ViewModels
		// initialise) hides it, but that is a coincidence, not an invariant: any
		// lazy event registration breaks it, and the only symptom is that nothing
		// works.
		const existing = this.registry.get(eventType);
		const meta: ILankaEventMetadata = {
			dataType: metadata.dataType ?? existing?.meta.dataType ?? "any",
			description:
				metadata.description ??
				existing?.meta.description ??
				`Registered event: ${eventType}`,
			// `usedBy` lists everyone using the event and exists precisely to be
			// complete. Replacing it would erase half.
			usedBy: [...new Set([...(existing?.meta.usedBy ?? []), ...(metadata.usedBy ?? [])])],
			schema: metadata.schema ?? existing?.meta.schema,
			priority: metadata.priority ?? existing?.meta.priority ?? 0,
			maxLogs: metadata.maxLogs ?? existing?.meta.maxLogs ?? this.defaultMaxLogs,
			replay: metadata.replay ?? existing?.meta.replay,
		};

		if (existing) {
			existing.meta = meta;
			return;
		}

		this.registry.set(eventType, { meta, logs: [], buffer: [], subs: [] });
	}

	/** Every registered event with its metadata. */
	public getRegisteredEvents() {
		return Array.from(this.registry.entries())
			.map(([eventType, state]) => ({
				eventType,
				metadata: state.meta,
			}))
			.sort((a, b) => a.eventType.localeCompare(b.eventType));
	}

	/** Metadata of one event type. */
	public getEventInfo(eventType: string): ILankaEventMetadata | null {
		return this.registry.get(eventType)?.meta ?? null;
	}

	/** How many live subscriptions this event has. */
	/**
	 * How many values sit in the event's buffer.
	 *
	 * Exists for the test: "the buffer stays empty until someone asks for replay"
	 * is a claim about MEMORY, and nothing but asking can check it.
	 */
	public getBufferedCount(eventType: string): number {
		return this.registry.get(eventType)?.buffer.length ?? 0;
	}

	public getSubscriptions(eventType: string): number {
		return this.registry.get(eventType)?.subs.length ?? 0;
	}

	/**
	 * Subscribes a handler to an event type.
	 *
	 * @param eventType Event type
	 * @param callback What to run on dispatch
	 * @param options Subscription options:
	 *  - `priority` — execution order, higher runs earlier;
	 *  - `replay` — receive what was dispatched before subscribing;
	 *  - `usedBy` — who subscribed, for the inspector.
	 */
	public subscribe<T>(
		eventType: string,
		callback: (data: T) => void,
		options?: {
			priority?: number;
			replay?: TLankaReplayRequest;
			usedBy?: string;
		},
	): () => void {
		const state = this.ensureEvent(eventType, options?.usedBy);
		const prio = options?.priority ?? state.meta.priority ?? 0;
		const entry: TSubscriptionEntry<unknown> = {
			callback: callback as unknown as (data: unknown) => void,
			priority: prio,
			replayCount: resolveReplayCount(options?.replay),
		};

		const subs = state.subs;
		let low = 0,
			high = subs.length;
		while (low < high) {
			const mid = (low + high) >>> 1;
			if (subs[mid].priority < prio) high = mid;
			else low = mid + 1;
		}
		subs.splice(low, 0, entry);

		if (options?.replay) this.scheduleBatchedReplay(eventType, state);

		// The returned function removes EXACTLY this record, not the first one with
		// the same callback: by callback, two subscriptions of one function are
		// indistinguishable.
		return () => {
			const at = state.subs.indexOf(entry);
			if (at !== -1) state.subs.splice(at, 1);
		};
	}

	/**
	 * Removes a handler from an event type.
	 *
	 * @param eventType Event type
	 * @param callback A previously subscribed handler
	 */
	public unsubscribe<T>(eventType: string, callback: (data: T) => void): void {
		const state = this.registry.get(eventType);
		if (!state) return;
		const subs = state.subs;
		for (let i = 0; i < subs.length; i++) {
			if (subs[i].callback === callback) {
				subs.splice(i, 1);
				break;
			}
		}
	}

	/**
	 * Dispatches an event: the middleware chain first, then subscribers.
	 *
	 * @param eventType Event type
	 * @param data Payload
	 * @param usedBy Who dispatched — recorded in the metadata
	 */
	public dispatch<T>(eventType: string, data?: T, usedBy?: string): void {
		const state = this.ensureEvent(eventType, usedBy);
		const { meta, subs, buffer } = state;

		// Payload shape check
		if (meta.schema && data !== undefined && !meta.schema(data)) {
			lankaLogger.printScenarioLog(`Invalid data for event "${eventType}":`, data);
			this.report({ eventType, outcome: "invalid", subscribers: subs.length });
			return;
		}

		this.logEvent(state, eventType, data);

		const deliver = (): void => {
			// Iterate a COPY. A subscriber may unsubscribe inside its own handler —
			// "waited for the session, then unsubscribed" is a routine pattern — and
			// `unsubscribe` splices this same array, so iterating the original skips
			// a neighbour silently.
			//
			// The deliberate side effect: subscribing DURING delivery waits for the
			// next event. Otherwise delivery order would depend on subscription
			// timing, which is undefined.
			for (const entry of [...subs]) {
				try {
					entry.callback(data);
				} catch (err) {
					lankaLogger.printScenarioLog(`Error dispatching event "${eventType}":`, err);
				}
			}
		};

		// Every middleware RETURNS a decision. A `next()`-based shape means not
		// calling it makes the event vanish silently.
		//
		// An exception is the same case as "did not call next": it also stops
		// delivery, so it is handled the same way and names itself in the log,
		// instead of surfacing and breaking whoever dispatched.
		for (const middleware of [...this.middlewares]) {
			let decision: TLankaEventBusDecision;
			try {
				decision = middleware(eventType, data);
			} catch (err) {
				decision = { stop: err instanceof Error ? err.message : String(err) };
			}

			if (decision !== "pass") {
				this.markStopped(state, decision.stop);
				lankaLogger.printScenarioLog(
					`Event "${eventType}" stopped by middleware:`,
					decision.stop,
				);
				// The one place that knows WHICH middleware stopped it. A middleware
				// cannot learn this about a middleware after itself, which is why an
				// inspector needed an observer rather than a sixth middleware.
				this.report({
					eventType,
					outcome: "stopped",
					subscribers: subs.length,
					stoppedBy: decision.stop,
				});
				return;
			}
		}

		// AFTER the chain, and that ordering is the guarantee.
		//
		// The buffer used to be filled before the middlewares ran, so an event the
		// chain STOPPED still sat in it — and the next subscriber asking for replay
		// received a payload no subscriber had been allowed to see, with nothing in
		// the bus log recording that delivery. Middleware is how an application
		// gates an event (an authorisation check, a privacy filter, a feature
		// flag); a gate the framework routes around is not a gate.
		//
		// The buffer exists ONLY on demand and holds exactly what the greediest
		// subscriber asked for. Buffering every payload unconditionally holds up to
		// a hundred payloads per event type until the end of the session — in an app
		// where user data arrives over SSE, that is personal data kept in memory
		// with no consumer.
		const depth = Math.max(resolveReplayCount(meta.replay), maxReplayDepth(subs));
		if (depth > 0) {
			buffer.push(data);
			while (buffer.length > depth) buffer.shift();
		} else if (buffer.length > 0) {
			// The last replay asker unsubscribed — nothing left to hold.
			buffer.length = 0;
		}

		deliver();
		this.report({ eventType, outcome: "delivered", subscribers: subs.length });
	}

	/** Adds middleware to the shared chain. */
	public addMiddleware<T>(mw: TLankaEventBusMiddleware<T>): void {
		this.middlewares.push(mw as unknown as TLankaEventBusMiddleware<unknown>);
	}

	/** Removes previously added middleware. */
	public removeMiddleware<T>(mw: TLankaEventBusMiddleware<T>): void {
		const i = this.middlewares.indexOf(mw as unknown as TLankaEventBusMiddleware<unknown>);
		if (i !== -1) this.middlewares.splice(i, 1);
	}

	/**
	 * Watches what became of each dispatch. An extension point — the sixth.
	 *
	 * An observer never decides: its return value is ignored, and a throw from it
	 * is logged rather than surfaced. A diagnostic tool that could stop an event
	 * would make "I disabled the inspector and it started working" a sentence
	 * somebody says.
	 */
	public addObserver(observer: TLankaEventBusObserver): void {
		this.observers.push(observer);
	}

	/** Removes a previously added observer. */
	public removeObserver(observer: TLankaEventBusObserver): void {
		const i = this.observers.indexOf(observer);
		if (i !== -1) this.observers.splice(i, 1);
	}

	/**
	 * Log of dispatched events, oldest first, `limit` most recent kept.
	 *
	 * ## Why the records are sorted rather than concatenated
	 *
	 * They are held per event TYPE, so that each type keeps its own `maxLogs`
	 * and a chatty event cannot push a quiet one's history out. Concatenating
	 * those lists puts every record of one type before every record of the next,
	 * and `slice(-limit)` then answers the tail of whichever type the registry
	 * happened to hold last — not the most recent events at all. On a bus with
	 * one event type nothing looked wrong; on a real one the log was a
	 * chronology that had never been in chronological order.
	 *
	 * @param eventType Limit to one type
	 * @param limit How many recent records to return
	 */
	public getEventLogs(eventType?: string, limit = 100): ILankaEventLog[] {
		if (eventType) {
			return this.registry.get(eventType)?.logs.slice(-limit) ?? [];
		}
		const all: ILankaEventLog[] = [];
		for (const { logs } of this.registry.values()) all.push(...logs);
		// By `sequence`, not by `timestamp`: a timestamp has millisecond
		// resolution and a burst — an SSE storm, bootstrap — dispatches many
		// events inside one, so sorting by it would leave those in the order the
		// concatenation happened to produce, which is the defect itself.
		all.sort((left, right) => (left.sequence ?? 0) - (right.sequence ?? 0));
		return all.slice(-limit);
	}

	/** Removes an event together with its subscriptions, log and buffer. */
	public clearEvent(eventType: string): void {
		this.registry.delete(eventType);
		const t = this.pendingReplayTimers.get(eventType);
		if (t) {
			clearTimeout(t);
			this.pendingReplayTimers.delete(eventType);
		}
	}

	/** Removes every event and any scheduled replays. */
	public clearAllEvents(): void {
		this.registry.clear();
		for (const t of this.pendingReplayTimers.values()) clearTimeout(t);
		this.pendingReplayTimers.clear();
	}

	/** Full bus reset: events, middleware and observers. */
	public reset(): void {
		this.clearAllEvents();
		this.middlewares = [];
		this.observers = [];
		this.isEnableLogs = false;
	}

	// -------------------------------------------------------------------------
	// Internal helpers
	// -------------------------------------------------------------------------

	/**
	 * Tells the observers what became of a dispatch.
	 *
	 * The empty-list check is the whole reason a bus nobody watches pays nothing
	 * for this: `dispatch` is a hot path, and an iteration over an empty array on
	 * every event would be a cost paid by every application for a feature almost
	 * none of them installs. Measured in `LankaEventBusInstance.bench.ts`.
	 *
	 * An observer that throws is logged and the next one still runs — the same
	 * treatment a subscriber gets, and for the same reason: a diagnostic tool must
	 * not be able to break the application it is diagnosing.
	 */
	private report(outcome: ILankaEventBusOutcome): void {
		if (this.observers.length === 0) return;

		for (const observer of [...this.observers]) {
			try {
				observer(outcome);
			} catch (err) {
				lankaLogger.printScenarioLog(
					`Event bus observer failed for "${outcome.eventType}":`,
					err,
				);
			}
		}
	}

	/**
	 * Marks the last log record with the reason it was stopped.
	 *
	 * Writes where `logEvent` just put the event: a stop is not a separate
	 * occurrence but this one's outcome.
	 */
	private markStopped(state: TEventState, reason: string): void {
		const last = state.logs.at(-1);
		if (last) last.stoppedBy = reason;
	}

	/** Add an event log entry for debugging/auditing. */
	private logEvent(state: TEventState, eventType: string, data: unknown): void {
		if (this.isEnableLogs) {
			const cap = state.meta.maxLogs ?? this.defaultMaxLogs;
			const logs = state.logs;
			this.dispatchCount += 1;
			const log: ILankaEventLog = {
				eventType,
				timestamp: new Date().toISOString(),
				data,
				sequence: this.dispatchCount,
			};
			log.stackTrace = new Error().stack;
			logs.push(log);
			if (logs.length > cap) logs.shift();
		}
	}

	/**
	 * Schedules replay for late subscribers that asked for it.
	 *
	 * Replays are batched into one tick: otherwise ten subscriptions to one event
	 * would make ten separate passes over the same buffer.
	 */
	private scheduleBatchedReplay(eventType: string, state: TEventState): void {
		if (this.pendingReplayTimers.has(eventType)) return;

		const timer = setTimeout(() => {
			this.pendingReplayTimers.delete(eventType);
			const { buffer, subs } = state;
			if (!buffer.length) return;

			const needReplay = subs.filter((s) => s.replayCount > 0);
			if (!needReplay.length) return;

			for (const entry of needReplay) {
				// Each gets what IT asked for, not what the buffer happens to hold.
				for (const payload of buffer.slice(-entry.replayCount)) {
					try {
						entry.callback(payload);
					} catch (err) {
						lankaLogger.printScenarioLog(
							`Error dispatching event "${eventType}" (replay):`,
							err,
						);
					}
				}
			}

			// Replay is an event of subscribing, not a property of the subscriber: it
			// does not happen a second time.
			for (const entry of needReplay) entry.replayCount = 0;
		}, 0);

		this.pendingReplayTimers.set(eventType, timer);
	}
}
