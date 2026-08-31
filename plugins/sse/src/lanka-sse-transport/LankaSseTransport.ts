import { getLankaHost } from "lanka/config";

export type TLankaSseEventCallback = (data: Record<string, unknown>) => void;
export type TLankaSseReconnectCallback = () => void;

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
	 * Refreshes authorization when attempts are exhausted. `true` means try again.
	 *
	 * A function, not a URL: a plugin that knew the endpoint would also know the
	 * response shape and how the session is stored.
	 */
	refreshAuth?: () => Promise<boolean>;
	/** The session is lost for good: the application signs the user out. */
	onSessionLost?: () => void;
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
	private reconnectAttempts = 0;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private hadError = false;
	/** Disconnected EXPLICITLY: everything scheduled after this must die. */
	private stopped = false;

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

		let source: EventSource;
		try {
			source = new EventSource(this.url(), { withCredentials: this.config.withCredentials });
		} catch {
			// Some engines expose the constructor but refuse the connection (scheme,
			// proxy, strict CSP). Give up quietly rather than enter a reconnect
			// loop: retrying what cannot succeed is a storm.
			this.eventSource = null;
			return;
		}

		this.eventSource = source;

		source.onopen = () => {
			if (this.hadError) {
				this.hadError = false;
				// A copy: a handler may unsubscribe inside itself.
				for (const callback of [...this.reconnectCallbacks]) callback();
			}
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
			this.hadError = true;
			source.close();
			this.eventSource = null;
			void this.scheduleReconnect();
		};

		source.onmessage = (event: MessageEvent) => {
			const data = unwrap(event.data);
			if (!data) return;
			const type = typeof data.type === "string" ? data.type : undefined;
			if (type) this.dispatch(type, data);
		};

		for (const eventType of this.listeners.keys()) this.listenTo(eventType);
	}

	public disconnect(): void {
		// A flag rather than "wind the counter to its limit": a scheduled reconnect
		// may be waiting on an auth refresh, and by the time it returns the counter
		// means nothing — the connection would come up AFTER an explicit
		// disconnect.
		this.stopped = true;
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
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
		this.eventSource?.addEventListener(eventType, (event: MessageEvent) => {
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

	private async scheduleReconnect(): Promise<void> {
		if (this.stopped) return;

		const maxAttempts = this.config.maxReconnectAttempts ?? 10;
		if (this.reconnectAttempts >= maxAttempts) {
			const refreshed = (await this.config.refreshAuth?.()) ?? false;
			if (this.stopped) return;
			if (refreshed) {
				this.reconnectAttempts = 0;
				this.connect();
				return;
			}
			this.config.onSessionLost?.();
			return;
		}

		// Growing backoff with a ceiling: a steady stream of attempts against a
		// server that drops the connection immediately is a storm that finishes it.
		const maxDelay = this.config.maxReconnectDelayMs ?? 30_000;
		const delay = Math.min(1000 * 2 ** this.reconnectAttempts, maxDelay);
		this.reconnectAttempts += 1;

		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;
			if (!this.stopped) this.connect();
		}, delay);
	}
}
