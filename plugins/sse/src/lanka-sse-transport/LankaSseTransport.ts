import { getLankaHost } from "lanka/config";
import type { TLankaStreamEventCallback, TLankaStreamReconnectCallback } from "lanka/stream";

/**
 * The names this package published before the shapes were shared.
 *
 * Aliases rather than second declarations: a bridge written against
 * `lanka/stream` and one written against this package must be the same
 * function type, or the port would only look interchangeable.
 */
export type TLankaSseEventCallback = TLankaStreamEventCallback;
export type TLankaSseReconnectCallback = TLankaStreamReconnectCallback;

export interface ILankaSseConfig {
	/** Stream path relative to `host.apiBaseUrl`. Defaults to `/sse/events`. */
	path?: string;
	/** Whether to send cookies. On by default: the session usually lives there. */
	withCredentials?: boolean;
	/** How many reconnect attempts before giving up. Defaults to 10. */
	maxReconnectAttempts?: number;
	/** Ceiling on the pause between attempts. Defaults to 30 seconds. */
	maxReconnectDelayMs?: number;
	/**
	 * Randomises each pause between attempts. Defaults to `"full"`.
	 *
	 * `"full"` waits anywhere up to the step's ceiling, `"equal"` at least half of
	 * it, `"none"` exactly the ceiling. On by default: after a deploy every client
	 * loses its stream in the same second, and without jitter all of them come
	 * back — and resync through `onReconnect` — in the same second, on every rung
	 * of the ladder.
	 */
	reconnectJitter?: "full" | "equal" | "none";
	/**
	 * Refreshes authorization. `true` means try again.
	 *
	 * A function, not a URL: a plugin that knew the endpoint would also know the
	 * response shape and how the session is stored.
	 */
	refreshAuth?: () => Promise<boolean>;
	/**
	 * When `refreshAuth` is called. Defaults to `"first-refused-reconnect"`.
	 *
	 * `"first-refused-reconnect"`: once per outage, when a reconnect to a stream that had
	 * been open fails before opening — `EventSource` cannot see a 401, so an
	 * expired token looks exactly like a network error, and waiting for the
	 * ceiling keeps the stream dead for minutes. Again at the ceiling, as with
	 * `"exhausted"`, which calls it only there.
	 */
	refreshAuthOn?: "first-refused-reconnect" | "exhausted";
	/** The session is lost for good: the application signs the user out. */
	onSessionLost?: () => void;
	/**
	 * A watchdog for a half-open stream. Off by default.
	 *
	 * After a network switch a connection can stay `OPEN` and fire no `error`
	 * while delivering nothing, until the OS gives up on the socket minutes later.
	 * With a heartbeat, no frame for `timeoutMs` closes the connection and
	 * reconnects through the ladder, so `onReconnect` runs as for any other drop.
	 *
	 * Only what `EventSource` dispatches can count. An SSE comment line
	 * (`: ping`) and an event with no `data:` line never reach script: a server
	 * keeping alive that way is, to the watchdog, silent, and the stream is
	 * reconnected every `timeoutMs` while perfectly healthy.
	 */
	heartbeat?: {
		/**
		 * The keep-alive event the server sends — a named event WITH a `data:` line,
		 * empty is fine. Any dispatched frame counts as proof of life.
		 */
		event?: string;
		timeoutMs: number;
	};
	/** Page visibility, for mobile WebViews that keep running in the background. Off by default. */
	visibility?: {
		/** `"pause"`: no reconnect attempt while the page is hidden, and none counted. Defaults to `"continue"`. */
		whileHidden?: "continue" | "pause";
		/**
		 * `"reconnect"`: becoming visible with no connection resets the counter and
		 * connects now. Defaults to `"resume"`: an attempt paused while hidden is made.
		 */
		onVisible?: "resume" | "reconnect";
	};
}

interface ISseEnvelope {
	trigger: string;
	payload: Record<string, unknown>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isEnvelope = (value: unknown): value is ISseEnvelope =>
	isRecord(value) && typeof value.trigger === "string" && isRecord(value.payload);

/**
 * Unwraps the `{ trigger, payload }` envelope.
 *
 * A bare body is accepted too: refusing the second form would silently lose
 * events for a backend that still sends it.
 */
const unwrap = (raw: unknown): Record<string, unknown> | null => {
	if (typeof raw !== "string") return null;
	// An event with no data is a signal — a keep-alive, a "something changed".
	// Dropping it as unparseable meant a bridge subscribed to it was never called.
	if (raw === "") return {};
	try {
		const parsed: unknown = JSON.parse(raw);
		if (isEnvelope(parsed)) return parsed.payload;
		if (isRecord(parsed)) return parsed;
		return null;
	} catch {
		return null;
	}
};

/**
 * The server event stream: connection, reconnection, envelope parsing.
 *
 * ## No `EventSource` is not a failure
 *
 * On an engine without it the plugin is simply off for the session: every screen
 * keeps working because the same data arrives through route loaders — the app
 * updates on navigation instead of instantly. Support is therefore CHECKED
 * rather than left to an exception.
 *
 * ## The URL comes from the host
 *
 * Reading `import.meta.env.VITE_API_URL` would mean knowing the consumer's
 * bundler and the name of a variable in their environment: a package that reads
 * someone else's build global works for exactly one consumer.
 */
export class LankaSseTransport {
	private readonly config: ILankaSseConfig & { path: string; withCredentials: boolean };
	private readonly listeners = new Map<string, Set<TLankaSseEventCallback>>();
	private readonly reconnectCallbacks = new Set<TLankaSseReconnectCallback>();
	private eventSource: EventSource | null = null;
	/**
	 * Event types the CURRENT connection already has a listener for.
	 *
	 * `EventSource` listeners are never removed, only the connection is: a type
	 * that was subscribed, dropped and subscribed again used to get a second
	 * listener on the same connection, and every handler for it then ran twice
	 * per event. Cleared with the connection, because a new one starts with none.
	 */
	private readonly attached = new Set<string>();
	private reconnectAttempts = 0;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	/**
	 * A connection has opened at least once.
	 *
	 * Separate from `hadError`, and both are needed. A first attempt that FAILS
	 * and a second that succeeds is not a reconnection — nothing was ever
	 * delivered, so nothing was missed — and announcing one there makes every
	 * screen refetch the data it has just loaded.
	 */
	private everConnected = false;
	private hadError = false;
	/** Disconnected EXPLICITLY: everything scheduled after this must die. */
	private stopped = false;
	/** The session was declared lost, or the engine refused: nothing revives the stream but `connect()`. */
	private gaveUp = false;
	/**
	 * Bumped by every connection made.
	 *
	 * A refresh is awaited, and while it is out the page can come back, the
	 * application can call `connect()`, and that connection can fail and start
	 * a ladder of its own. The answer then belongs to a ladder that no longer
	 * exists: acting on it armed a second ladder beside the live one, or declared
	 * the session lost while the restarted one still had attempts to make.
	 */
	private generation = 0;
	/** The early `refreshAuth` was spent for this outage. Reset when a connection opens. */
	private refreshedThisOutage = false;
	private heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
	/**
	 * The page has reported `visible` at least once.
	 *
	 * Some WebViews report `hidden` and never `visible` again. A pause trusted
	 * there would latch forever, so until the page has once said `visible`,
	 * visibility is ignored.
	 */
	private seenVisible = false;
	/** An attempt fell due while hidden and waits for the page to come back. */
	private waitingForVisible = false;
	private watchingVisibility = false;

	public constructor(config: ILankaSseConfig = {}) {
		this.config = {
			...config,
			path: config.path ?? "/sse/events",
			withCredentials: config.withCredentials ?? true,
		};
	}

	/** Whether this engine supports server events at all. */
	public isSupported(): boolean {
		return typeof EventSource === "function";
	}

	public connect(): void {
		if (this.eventSource) return;
		if (!this.isSupported()) return;

		this.stopped = false;
		this.gaveUp = false;
		this.generation += 1;
		this.watchVisibility();

		let source: EventSource;
		try {
			source = new EventSource(this.url(), { withCredentials: this.config.withCredentials });
		} catch {
			// Some engines expose the constructor but refuse the connection (scheme,
			// proxy, strict CSP). Give up quietly rather than enter a reconnect
			// loop: retrying what cannot succeed is a storm.
			this.eventSource = null;
			this.gaveUp = true;
			return;
		}

		this.eventSource = source;
		this.attached.clear();
		/** Whether THIS connection opened: a failure before that is a refused reconnect. */
		let opened = false;

		source.onopen = () => {
			opened = true;
			this.refreshedThisOutage = false;
			this.armHeartbeat();
			// Both conditions: a connection that never opened before means nothing
			// was missed, and no error since the last open means this is the same
			// connection reporting itself twice.
			if (this.everConnected && this.hadError) {
				// A copy: a handler may unsubscribe inside itself.
				for (const callback of [...this.reconnectCallbacks]) callback();
			}
			this.everConnected = true;
			this.hadError = false;
			// The counter resets ONLY here, on an open connection.
			//
			// Resetting it at the start of `connect()` is wrong: the reconnect timer
			// calls `connect()`, so the counter returns to zero on every attempt and
			// never reaches two. The ten-attempt ceiling then exists, reads as a
			// guard, and can never fire — reconnecting forever, once a second, to
			// the server that keeps dropping it.
			this.reconnectAttempts = 0;
		};

		source.onerror = () => {
			this.drop(source, opened);
		};

		source.onmessage = (event: MessageEvent) => {
			this.armHeartbeat();
			const data = unwrap(event.data);
			if (!data) return;
			const type = typeof data.type === "string" ? data.type : undefined;
			if (type) this.dispatch(type, data);
		};

		const heartbeatEvent = this.config.heartbeat?.event;
		if (heartbeatEvent) this.listenTo(heartbeatEvent);
		for (const eventType of this.listeners.keys()) this.listenTo(eventType);
	}

	public disconnect(): void {
		// A flag rather than "wind the counter to its limit": a scheduled reconnect
		// may be waiting on an auth refresh, and by the time it returns the counter
		// means nothing — the connection would come up AFTER an explicit
		// disconnect.
		this.stopped = true;
		this.waitingForVisible = false;
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
		this.clearHeartbeat();
		if (this.watchingVisibility) {
			document.removeEventListener("visibilitychange", this.onVisibilityChange);
			this.watchingVisibility = false;
		}
		this.eventSource?.close();
		this.eventSource = null;
	}

	/** Subscribes to an event type. Returns an unsubscribe function. */
	public on(eventType: string, callback: TLankaSseEventCallback): () => void {
		let callbacks = this.listeners.get(eventType);
		if (!callbacks) {
			callbacks = new Set();
			this.listeners.set(eventType, callbacks);
			if (this.eventSource) this.listenTo(eventType);
		}
		callbacks.add(callback);

		return () => {
			const current = this.listeners.get(eventType);
			if (!current) return;
			current.delete(callback);
			if (current.size === 0) this.listeners.delete(eventType);
		};
	}

	/** Notification after EVERY reconnection. Returns an unsubscribe function. */
	public onReconnect(callback: TLankaSseReconnectCallback): () => void {
		this.reconnectCallbacks.add(callback);
		return () => {
			this.reconnectCallbacks.delete(callback);
		};
	}

	private url(): string {
		const base = getLankaHost().apiBaseUrl.replace(/\/+$/, "");
		const path = this.config.path.startsWith("/") ? this.config.path : `/${this.config.path}`;
		return `${base}${path}`;
	}

	private listenTo(eventType: string): void {
		if (this.attached.has(eventType)) return;
		this.attached.add(eventType);
		this.eventSource?.addEventListener(eventType, (event: MessageEvent) => {
			this.armHeartbeat();
			const data = unwrap(event.data);
			if (data) this.dispatch(eventType, data);
		});
	}

	private dispatch(eventType: string, data: Record<string, unknown>): void {
		const callbacks = this.listeners.get(eventType);
		if (!callbacks) return;
		// A copy: a handler may unsubscribe inside itself, and iterating the live
		// set would skip a neighbour.
		for (const callback of [...callbacks]) callback(data);
	}

	/** The connection failed, or the watchdog declared it dead: close it and climb the ladder. */
	private drop(source: EventSource, opened: boolean): void {
		this.hadError = true;
		this.clearHeartbeat();
		source.close();
		this.eventSource = null;
		void this.scheduleReconnect(opened);
	}

	private async scheduleReconnect(opened: boolean): Promise<void> {
		if (this.stopped) return;
		const generation = this.generation;

		// A refused reconnect to a stream that WAS open is most likely an expired
		// token: the network that just carried the stream is the least likely thing
		// to be gone. Once per outage, so a real outage costs one refresh, not one
		// per attempt.
		//
		// A refusal here is NOT a lost session. During a network outage the refresh
		// fails for the same reason the stream did, and signing the user out on a
		// one-second blip is worse than the minutes this saves. The ladder goes on,
		// and its ceiling still has the last word.
		if (
			!opened &&
			this.everConnected &&
			!this.refreshedThisOutage &&
			this.config.refreshAuth &&
			(this.config.refreshAuthOn ?? "first-refused-reconnect") === "first-refused-reconnect"
		) {
			this.refreshedThisOutage = true;
			const refreshed = await this.refresh();
			if (this.stopped || generation !== this.generation) return;
			if (refreshed) {
				this.attempt();
				return;
			}
		}

		const maxAttempts = this.config.maxReconnectAttempts ?? 10;
		if (this.reconnectAttempts >= maxAttempts) {
			// The verdict waits for the page like an attempt does: the socket of the
			// last allowed attempt is cut the moment a phone backgrounds, and deciding
			// then is reaching the ceiling while nobody is looking.
			if (this.pausedByVisibility()) {
				this.waitingForVisible = true;
				return;
			}
			const refreshed = await this.refresh();
			if (this.stopped || generation !== this.generation) return;
			if (refreshed) {
				this.reconnectAttempts = 0;
				this.connect();
				return;
			}
			this.gaveUp = true;
			this.config.onSessionLost?.();
			return;
		}

		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;
			this.attempt();
		}, this.backoff());
	}

	/**
	 * Asks `refreshAuth`; absent or throwing, the answer is "not refreshed".
	 *
	 * A throw is the consumer's code failing inside a failure path. Letting it
	 * reject left the stream silently dead with an unhandled rejection; read as a
	 * refusal, the ladder goes on, or the ceiling reports the session lost.
	 */
	private async refresh(): Promise<boolean> {
		const refreshAuth = this.config.refreshAuth;
		if (!refreshAuth) return false;
		return Promise.resolve()
			.then(refreshAuth)
			.catch(() => false);
	}

	/**
	 * The pause before the next attempt.
	 *
	 * Growing with a ceiling: a steady stream of attempts against a server that
	 * drops the connection immediately is a storm that finishes it. Jittered:
	 * clients that dropped together must not return together.
	 */
	private backoff(): number {
		const ceiling = Math.min(
			1000 * 2 ** this.reconnectAttempts,
			this.config.maxReconnectDelayMs ?? 30_000,
		);
		switch (this.config.reconnectJitter ?? "full") {
			case "none":
				return ceiling;
			case "equal":
				return ceiling / 2 + (Math.random() * ceiling) / 2;
			case "full":
				return Math.random() * ceiling;
		}
	}

	/**
	 * One reconnect attempt — or none, while the page is hidden.
	 *
	 * The counter grows HERE, when an attempt is made, not when one is scheduled:
	 * an attempt skipped while hidden must not count towards the ceiling, or the
	 * user comes back to a session declared lost while nobody was looking.
	 */
	private attempt(): void {
		// A connection already open or connecting is not an attempt to count, and
		// a session declared lost is revived only by the application.
		if (this.stopped || this.gaveUp || this.eventSource) return;
		if (this.pausedByVisibility()) {
			this.waitingForVisible = true;
			return;
		}
		this.reconnectAttempts += 1;
		this.connect();
	}

	private armHeartbeat(): void {
		const heartbeat = this.config.heartbeat;
		if (!heartbeat) return;
		this.clearHeartbeat();
		this.heartbeatTimer = setTimeout(() => {
			this.heartbeatTimer = null;
			// A half-open stream: it opened, so this is a drop like any other, and
			// `onReconnect` must run when it comes back.
			if (this.eventSource) this.drop(this.eventSource, true);
		}, heartbeat.timeoutMs);
	}

	private clearHeartbeat(): void {
		if (!this.heartbeatTimer) return;
		clearTimeout(this.heartbeatTimer);
		this.heartbeatTimer = null;
	}

	/**
	 * Whether an attempt must wait for the page.
	 *
	 * `visibilityState` is read at every decision rather than mirrored in a flag
	 * set by the event: a WebView that misses an event would leave the flag wrong
	 * for the rest of the session.
	 */
	private pausedByVisibility(): boolean {
		if (this.config.visibility?.whileHidden !== "pause") return false;
		if (typeof document === "undefined") return false;
		if (document.visibilityState === "visible") {
			this.seenVisible = true;
			return false;
		}
		return this.seenVisible && document.visibilityState === "hidden";
	}

	private watchVisibility(): void {
		if (this.watchingVisibility || !this.config.visibility) return;
		if (typeof document === "undefined") return;
		if (document.visibilityState === "visible") this.seenVisible = true;
		document.addEventListener("visibilitychange", this.onVisibilityChange);
		this.watchingVisibility = true;
	}

	/**
	 * The page came back: the moment the user expects fresh data, and the one
	 * where the stream is furthest up the ladder.
	 *
	 * Through `attempt`, so `onReconnect` fires once when it opens, and never
	 * beside a connection already open or connecting.
	 */
	private readonly onVisibilityChange = (): void => {
		if (document.visibilityState !== "visible") return;
		this.seenVisible = true;
		if (this.stopped || this.gaveUp || this.eventSource) return;

		if (this.config.visibility?.onVisible === "reconnect") {
			if (this.reconnectTimer) {
				clearTimeout(this.reconnectTimer);
				this.reconnectTimer = null;
			}
			this.waitingForVisible = false;
			this.reconnectAttempts = 0;
			// Back from a long background the token has most likely expired — the
			// case the early refresh is for, and the one likeliest to have spent it
			// on a dead network.
			this.refreshedThisOutage = false;
			this.attempt();
			return;
		}
		if (this.waitingForVisible) {
			this.waitingForVisible = false;
			this.attempt();
		}
	};
}
