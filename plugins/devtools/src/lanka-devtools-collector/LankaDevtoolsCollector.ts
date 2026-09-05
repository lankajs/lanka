import { LankaRingBuffer } from "../ring-buffer/LankaRingBuffer";
import type { ILankaLoggerSink } from "lanka/logger";
import type { ILankaEventBusOutcome } from "lanka/scenario";

/**
 * What became of an event the inspector saw dispatched.
 *
 * `"pending"` is the fourth answer and it is not an outcome the bus reports: it
 * is what the inspector shows between the moment it recorded a dispatch and the
 * moment the bus said how that dispatch ended. A row stuck on it means delivery
 * never finished — which is a finding, not a gap.
 */
export type TLankaDevtoolsEventOutcome = "pending" | "delivered" | "stopped" | "invalid";

/** One event that passed through the bus. */
export interface ILankaDevtoolsEvent {
	at: number;
	eventType: string;
	/** How many subscribers there were at dispatch time. */
	subscribers: number;
	/** Delivered, stopped by a middleware, refused by the schema, or unfinished. */
	outcome: TLankaDevtoolsEventOutcome;
	/** Who stopped delivery, if it was stopped. */
	stoppedBy?: string;
}

/** One request that went out on the wire. */
export interface ILankaDevtoolsRequest {
	at: number;
	endpoint: string;
	durationMs: number;
	outcome: "ok" | "failed";
	/** The failure's message, when it failed. */
	error?: string;
}

/** One event type, as the application has used it so far. */
export interface ILankaDevtoolsScenario {
	eventType: string;
	subscribers: number;
	/** How many times it has been dispatched since collection started. */
	dispatches: number;
}

/** One log line. */
export interface ILankaDevtoolsLogLine {
	at: number;
	layer: string;
	level: string;
	message: string;
}

export interface ILankaDevtoolsSnapshot {
	events: readonly ILankaDevtoolsEvent[];
	logs: readonly ILankaDevtoolsLogLine[];
	requests: readonly ILankaDevtoolsRequest[];
	/** Every event type the application has registered or fired. */
	scenarios: readonly ILankaDevtoolsScenario[];
	/** How many requests are on the wire right now. */
	inFlight: number;
}

export interface ILankaDevtoolsCollectorConfig {
	/** How many recent events to keep. Defaults to 100. */
	maxEvents?: number;
	/** How many recent log lines to keep. Defaults to 200. */
	maxLogs?: number;
	/** How many recent requests to keep. Defaults to 100. */
	maxRequests?: number;
	/** Clock, so a test can move time. */
	clock?: () => number;
	/**
	 * The event types the application has REGISTERED, whichever have been fired.
	 *
	 * Without it the scenario list can only show what has already happened, and
	 * "my scenario never fires" — the question the list is opened for — is exactly
	 * the case with nothing to show. The plugin supplies the bus's registry here;
	 * a collector built by hand may supply nothing and lose only that.
	 */
	readScenarios?: () => readonly { eventType: string; subscribers: number }[];
}

/**
 * Collecting history for the inspector.
 *
 * ## Its own source, not someone else's side effect
 *
 * Reading the bus's always-on buffer would make the inspector depend on a leak:
 * up to a hundred payloads per event type living for the whole session. The
 * inspector therefore has its OWN source, enabled together with it — collecting
 * "just in case" is the same defect under another name.
 */
export class LankaDevtoolsCollector {
	private readonly events: LankaRingBuffer<ILankaDevtoolsEvent>;
	private readonly logs: LankaRingBuffer<ILankaDevtoolsLogLine>;
	private readonly requests: LankaRingBuffer<ILankaDevtoolsRequest>;
	private readonly clock: () => number;
	private readonly readScenarios: () => readonly { eventType: string; subscribers: number }[];
	private readonly dispatches = new Map<string, number>();
	private readonly listeners = new Set<() => void>();

	/**
	 * Dispatches recorded and not yet accounted for.
	 *
	 * A stack, because a subscriber dispatching another event nests: the inner
	 * dispatch finishes first, so the outcome that arrives belongs to the LAST
	 * unfinished row of that type rather than to the first.
	 */
	private readonly unfinished: ILankaDevtoolsEvent[] = [];

	private notifyQueued = false;
	private inFlight = 0;

	public constructor(config: ILankaDevtoolsCollectorConfig = {}) {
		this.events = new LankaRingBuffer(config.maxEvents ?? 100);
		this.logs = new LankaRingBuffer(config.maxLogs ?? 200);
		this.requests = new LankaRingBuffer(config.maxRequests ?? 100);
		this.clock = config.clock ?? (() => Date.now());
		this.readScenarios = config.readScenarios ?? (() => []);
	}

	/**
	 * A dispatch, recorded when it STARTS.
	 *
	 * The order the rows are read in is the order things happened, not the order
	 * they finished — and with a nested dispatch those differ. An inspector whose
	 * list reordered itself as events completed would be answering a question
	 * nobody asked.
	 */
	public recordEvent(event: Omit<ILankaDevtoolsEvent, "at" | "outcome">): void {
		const row: ILankaDevtoolsEvent = { ...event, at: this.clock(), outcome: "pending" };
		this.events.push(row);
		this.unfinished.push(row);
		this.dispatches.set(event.eventType, (this.dispatches.get(event.eventType) ?? 0) + 1);
		this.notify();
	}

	/**
	 * What the bus says became of a dispatch — the only source of `stoppedBy`.
	 *
	 * A middleware cannot learn this: it sees only the chain before itself, and
	 * the inspector's is the first one registered.
	 */
	public completeEvent(outcome: ILankaEventBusOutcome): void {
		const row = this.takeUnfinished(outcome.eventType);
		if (!row) {
			// Stopped by a middleware registered BEFORE the inspector's, so the
			// dispatch was never recorded. That it never reached the inspector is
			// itself worth showing.
			this.events.push({ ...outcome, at: this.clock() });
			this.notify();
			return;
		}

		row.outcome = outcome.outcome;
		row.subscribers = outcome.subscribers;
		if (outcome.stoppedBy !== undefined) row.stoppedBy = outcome.stoppedBy;
		this.notify();
	}

	/** One request, with what it cost and whether it arrived. */
	public recordRequest(request: Omit<ILankaDevtoolsRequest, "at">): void {
		this.requests.push({ ...request, at: this.clock() });
		this.notify();
	}

	public setInFlight(count: number): void {
		this.inFlight = count;
		this.notify();
	}

	/** The logger sink: lines arrive here exactly as they do at the console. */
	public createLoggerSink(): ILankaLoggerSink {
		return {
			emit: (entry) => {
				this.logs.push({
					at: this.clock(),
					layer: entry.layer,
					level: entry.level,
					message: typeof entry.message === "string" ? entry.message : "(function)",
				});
				this.notify();
			},
		};
	}

	/**
	 * Called when something was recorded. Returns a function that stops it.
	 *
	 * Coalesced to one call per microtask: a burst of twenty events in one turn
	 * must not become twenty redraws, or reading the inspector becomes the reason
	 * the application is slow.
	 */
	public subscribe(listener: () => void): () => void {
		this.listeners.add(listener);

		return () => {
			this.listeners.delete(listener);
		};
	}

	public getSnapshot(): ILankaDevtoolsSnapshot {
		return {
			events: this.events.toArray(),
			logs: this.logs.toArray(),
			requests: this.requests.toArray(),
			scenarios: this.buildScenarios(),
			inFlight: this.inFlight,
		};
	}

	public clear(): void {
		this.events.clear();
		this.logs.clear();
		this.requests.clear();
		this.unfinished.length = 0;
		this.dispatches.clear();
		this.notify();
	}

	/** The registered event types and what has happened to each. */
	private buildScenarios(): readonly ILankaDevtoolsScenario[] {
		const byType = new Map<string, ILankaDevtoolsScenario>();

		for (const registered of this.readScenarios()) {
			byType.set(registered.eventType, { ...registered, dispatches: 0 });
		}
		for (const [eventType, dispatches] of this.dispatches) {
			const known = byType.get(eventType);
			if (known) known.dispatches = dispatches;
			else byType.set(eventType, { eventType, subscribers: 0, dispatches });
		}

		return [...byType.values()].sort((a, b) => a.eventType.localeCompare(b.eventType));
	}

	/** The most recent unfinished dispatch of this type, removed from the stack. */
	private takeUnfinished(eventType: string): ILankaDevtoolsEvent | undefined {
		for (let index = this.unfinished.length - 1; index >= 0; index -= 1) {
			if (this.unfinished[index].eventType !== eventType) continue;

			const [row] = this.unfinished.splice(index, 1);
			return row;
		}

		return undefined;
	}

	private notify(): void {
		if (this.notifyQueued || this.listeners.size === 0) return;

		this.notifyQueued = true;
		queueMicrotask(() => {
			this.notifyQueued = false;
			for (const listener of [...this.listeners]) listener();
		});
	}
}
