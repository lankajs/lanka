import type { ILankaServerEventTransport } from "../../_interfaces/ILankaServerEventTransport";
import type { TLankaStreamEventCallback } from "../../_types/TLankaStreamEventCallback";
import type { TLankaStreamReconnectCallback } from "../../_types/TLankaStreamReconnectCallback";

/** What every pushing connection is configured with, whatever carries it. */
export interface ILankaStreamConfig {
	/** How many reconnect attempts before giving up. Defaults to 10. */
	maxReconnectAttempts?: number;
	/** The first pause between attempts; it doubles from there. Defaults to 1s. */
	reconnectDelayMs?: number;
	/** Ceiling on the pause between attempts. Defaults to 30 seconds. */
	maxReconnectDelayMs?: number;
	/**
	 * Refreshes authorization when attempts are exhausted. `true` means try again.
	 *
	 * A function, not a URL: a framework that knew the endpoint would also know
	 * the response shape and how the session is stored.
	 */
	refreshAuth?: () => Promise<boolean>;
	/** The session is lost for good: the application signs the user out. */
	onSessionLost?: () => void;
}

/**
 * How a subclass reports what happened on the wire.
 *
 * Three facts and no more, because they are the three the ladder above branches
 * on. A subclass able to reach further into the base could reset the attempt
 * counter or fire a reconnect by hand, which is exactly the state this class
 * exists to own.
 */
export interface ILankaStreamTransportHandlers {
	/**
	 * The connection is up and ready to carry subscriptions.
	 *
	 * Called by the subclass when the far end is actually usable — after a
	 * handshake, not merely after a socket opened — because the base answers it by
	 * subscribing to every event type somebody is waiting for.
	 */
	opened: () => void;
	/** A named event arrived. */
	received: (eventType: string, payload: Record<string, unknown>) => void;
	/** The connection is gone: dropped, refused, or closed by the far end. */
	lost: () => void;
}

/**
 * The half of a pushing connection that is the same for every protocol.
 *
 * Four transports in this repository — server-sent events, a WebSocket, a
 * `graphql-ws` subscription and a gRPC server stream — differ in how a
 * connection is opened and in how bytes become a named event. They do not
 * differ in anything below:
 *
 * - who is listening to which event type, and dispatch to a COPY of that set;
 * - the reconnect ladder: growing backoff with a ceiling, an attempt count that
 *   only resets on a connection that actually opened, one auth refresh at the
 *   end of it, and an explicit disconnect that outranks everything scheduled;
 * - `onReconnect` meaning "you missed something", so it never fires the first
 *   time.
 *
 * A subclass writes `open` and `close`, and `subscribeTo` / `unsubscribeFrom`
 * when the wire has to be told which events are wanted.
 *
 * ## A subclass never says "connected"
 *
 * Everything the ladder decides is decided here, off the three handlers. That is
 * what keeps a protocol package free of the bug this shape is prone to:
 * resetting the attempt counter where reconnection STARTS rather than where it
 * SUCCEEDS, after which a ten-attempt ceiling exists, reads as a guard, and can
 * never fire.
 */
export abstract class ALankaStreamTransport implements ILankaServerEventTransport {
	private readonly listeners = new Map<string, Set<TLankaStreamEventCallback>>();
	private readonly reconnectCallbacks = new Set<TLankaStreamReconnectCallback>();
	private readonly config: ILankaStreamConfig;
	private readonly handlers: ILankaStreamTransportHandlers;

	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private reconnectAttempts = 0;
	/** A connection exists as far as this class is concerned. */
	private live = false;
	/** The last connection ended badly, so the next `opened` is a RE-connection. */
	private hadError = false;
	/** Disconnected EXPLICITLY: everything scheduled after this must die. */
	private stopped = false;

	public constructor(config: ILankaStreamConfig = {}) {
		this.config = config;
		this.handlers = {
			opened: () => {
				this.acceptOpen();
			},
			received: (eventType, payload) => {
				this.dispatch(eventType, payload);
			},
			lost: () => {
				this.acceptLoss();
			},
		};
	}

	/**
	 * Whether this engine can carry the connection at all.
	 *
	 * `true` unless a subclass says otherwise, because most transports need
	 * nothing the platform might be missing. Where one does, the answer is a
	 * `typeof` guard: an engine without the global gets the plugin switched off
	 * for the session rather than a `ReferenceError` from inside the framework.
	 */
	public isSupported(): boolean {
		return true;
	}

	public connect(): void {
		if (this.live) return;
		if (!this.isSupported()) return;

		this.stopped = false;
		this.live = true;

		try {
			this.open(this.handlers);
		} catch {
			// Some engines expose the API and refuse the connection: a scheme a proxy
			// will not upgrade, a strict CSP, a URL the platform rejects. Give up
			// quietly rather than enter a reconnect loop — retrying what cannot
			// succeed is a storm.
			this.live = false;
		}
	}

	public disconnect(): void {
		// A flag rather than "wind the counter to its limit": a scheduled reconnect
		// may be waiting on an auth refresh, and by the time it returns the counter
		// means nothing — the connection would come up AFTER an explicit disconnect.
		this.stopped = true;
		this.clearReconnect();
		if (!this.live) return;

		this.live = false;
		this.close();
	}

	/** Subscribes to an event type. Returns an unsubscribe function. */
	public on(eventType: string, callback: TLankaStreamEventCallback): () => void {
		let callbacks = this.listeners.get(eventType);
		if (!callbacks) {
			callbacks = new Set();
			this.listeners.set(eventType, callbacks);
			if (this.live) this.subscribeTo(eventType);
		}
		callbacks.add(callback);

		return () => {
			this.forget(eventType, callback);
		};
	}

	/** Notification after EVERY reconnection. Returns an unsubscribe function. */
	public onReconnect(callback: TLankaStreamReconnectCallback): () => void {
		this.reconnectCallbacks.add(callback);

		return () => {
			this.reconnectCallbacks.delete(callback);
		};
	}

	/**
	 * Opens the connection and reports through the handlers.
	 *
	 * Called once per attempt. Throwing is allowed and means "this engine cannot
	 * do it": the transport goes quiet instead of retrying.
	 */
	protected abstract open(handlers: ILankaStreamTransportHandlers): void;

	/**
	 * Closes whatever `open` opened.
	 *
	 * Must be idempotent: the base calls it on an explicit disconnect AND after a
	 * loss the subclass already noticed, and neither knows what the other did.
	 */
	protected abstract close(): void;

	/**
	 * Tells the wire that an event type is wanted, where the wire needs telling.
	 *
	 * Called for every already-known type as soon as a connection opens, and for
	 * each new one after that — so a subclass never has to remember what was
	 * subscribed before the link came back.
	 */
	protected subscribeTo(eventType: string): void {
		void eventType;
		/* Most wires deliver everything and need no per-event registration. */
	}

	/** The reverse, when the last subscriber of a type goes away. */
	protected unsubscribeFrom(eventType: string): void {
		void eventType;
		/* Nothing to take back unless a subclass registered something. */
	}

	/** Every event type somebody is waiting for right now. */
	protected subscribedEventTypes(): readonly string[] {
		return [...this.listeners.keys()];
	}

	private acceptOpen(): void {
		for (const eventType of this.listeners.keys()) this.subscribeTo(eventType);

		if (this.hadError) {
			this.hadError = false;
			// A copy: a handler may unsubscribe inside itself.
			for (const callback of [...this.reconnectCallbacks]) callback();
		}

		// The counter resets ONLY here, on a connection that actually opened.
		// Resetting it in `connect()` would return it to zero on every attempt,
		// because the reconnect timer calls `connect()`.
		this.reconnectAttempts = 0;
	}

	private acceptLoss(): void {
		this.hadError = true;
		this.live = false;
		this.close();
		void this.scheduleReconnect();
	}

	private forget(eventType: string, callback: TLankaStreamEventCallback): void {
		const current = this.listeners.get(eventType);
		if (!current) return;

		current.delete(callback);
		if (current.size > 0) return;

		this.listeners.delete(eventType);
		if (this.live) this.unsubscribeFrom(eventType);
	}

	private dispatch(eventType: string, payload: Record<string, unknown>): void {
		const callbacks = this.listeners.get(eventType);
		if (!callbacks) return;

		// A copy: a handler may unsubscribe inside itself, and iterating the live
		// set would skip a neighbour.
		for (const callback of [...callbacks]) callback(payload);
	}

	private clearReconnect(): void {
		if (!this.reconnectTimer) return;

		clearTimeout(this.reconnectTimer);
		this.reconnectTimer = null;
	}

	private async scheduleReconnect(): Promise<void> {
		if (this.stopped) return;

		if (this.reconnectAttempts >= (this.config.maxReconnectAttempts ?? 10)) {
			await this.lastResort();
			return;
		}

		// Growing backoff with a ceiling: a steady stream of attempts against a
		// server that drops the connection immediately is a storm that finishes it.
		const first = this.config.reconnectDelayMs ?? 1000;
		const delay = Math.min(
			first * 2 ** this.reconnectAttempts,
			this.config.maxReconnectDelayMs ?? 30_000,
		);
		this.reconnectAttempts += 1;

		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;
			if (!this.stopped) this.connect();
		}, delay);
	}

	/**
	 * The attempts are spent: refresh the session once, or report it lost.
	 *
	 * `stopped` is re-read after the await. The refresh is a network call of
	 * unknown length, and an application that signed the user out while it was in
	 * flight must not be handed a connection afterwards.
	 */
	private async lastResort(): Promise<void> {
		const refreshed = (await this.config.refreshAuth?.()) ?? false;
		if (this.stopped) return;

		if (!refreshed) {
			this.config.onSessionLost?.();
			return;
		}

		this.reconnectAttempts = 0;
		this.connect();
	}
}
