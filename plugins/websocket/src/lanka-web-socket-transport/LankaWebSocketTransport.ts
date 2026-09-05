import { getLankaHost } from "lanka/config";
import {
	ALankaStreamTransport,
	type ILankaStreamConfig,
	type ILankaStreamTransportHandlers,
} from "lanka/stream";
import type { ILankaWebSocketChannel } from "../_interfaces/ILankaWebSocketChannel";

/** One named message, in either direction. */
export interface ILankaWebSocketMessage {
	type: string;
	payload: Record<string, unknown>;
}

/** Turns a raw frame into a named message, or refuses it. */
export type TLankaWebSocketFrameReader = (raw: string) => ILankaWebSocketMessage | null;

/** Turns a named message into a raw frame. */
export type TLankaWebSocketFrameWriter = (
	eventType: string,
	payload: Record<string, unknown>,
) => string;

export interface ILankaWebSocketConfig extends ILankaStreamConfig {
	/** Socket path relative to `host.apiBaseUrl`. Defaults to `/ws`. */
	path?: string;
	/**
	 * The whole address, when it is not under the API base at all.
	 *
	 * A socket often lives on its own host, and inventing a rule for deriving one
	 * from the other would be a guess this package cannot check.
	 */
	url?: string;
	/** Subprotocols offered in the handshake. */
	protocols?: string | readonly string[];
	/**
	 * How often to ping. Off by default.
	 *
	 * A heartbeat against a server that does not answer pings would close a
	 * connection that works, so it is switched on with knowledge of the backend
	 * rather than assumed.
	 */
	heartbeatMs?: number;
	/** How long an unanswered ping may stand before the link counts as dead. Defaults to `heartbeatMs`. */
	heartbeatTimeoutMs?: number;
	/** The event type a ping is sent as. Defaults to `ping`. */
	heartbeatEventType?: string;
	/** Hold messages sent while the link is down. On by default. */
	queueWhileClosed?: boolean;
	/** How many held messages before the oldest is dropped. Defaults to 50. */
	maxQueuedMessages?: number;
	/** Reads a frame the backend's own way. */
	readFrame?: TLankaWebSocketFrameReader;
	/** Writes a frame the backend's own way. */
	writeFrame?: TLankaWebSocketFrameWriter;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The default envelope: `{ type, payload }`, or `{ type, ...fields }`.
 *
 * Both, because a WebSocket has no per-event channel — the type has to be IN the
 * frame — and the two shapes are what backends actually send. `trigger` is
 * accepted as a second spelling of `type` for the same reason
 * `@lankajs/plugin-sse` accepts it: a backend already sending it would otherwise
 * lose every event silently.
 */
const readDefaultFrame: TLankaWebSocketFrameReader = (raw) => {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return null;
	}
	if (!isRecord(parsed)) return null;

	const named = parsed.type ?? parsed.trigger;
	if (typeof named !== "string") return null;

	if (isRecord(parsed.payload)) return { type: named, payload: parsed.payload };

	const { type: _type, trigger: _trigger, ...rest } = parsed;
	return { type: named, payload: rest };
};

const writeDefaultFrame: TLankaWebSocketFrameWriter = (eventType, payload) =>
	JSON.stringify({ type: eventType, payload });

/**
 * A WebSocket as a source of change, and as a way to answer.
 *
 * ## What it adds to the shared ladder
 *
 * `ALankaStreamTransport` already owns who is listening, dispatch, backoff, the
 * attempt ceiling and the auth refresh. Three things are this wire's own:
 *
 * - **The frame carries the event type.** There is no per-event channel, so the
 *   name is read out of the body — and `readFrame` replaces that entirely for a
 *   protocol somebody else designed.
 * - **An outbox.** A message sent during a reconnect is held and flushed, and the
 *   buffer is bounded because an unbounded one on a link that never returns is a
 *   leak that looks like patience.
 * - **A heartbeat.** A half-open socket — peer gone, state still `OPEN` — is the
 *   failure a WebSocket has and a server-sent stream does not: nothing arrives,
 *   nothing errors, and the screen is quietly stale forever.
 *
 * ## No `WebSocket` is not a failure
 *
 * On an engine without it the plugin is off for the session and every screen
 * keeps working, because the same data arrives through ordinary requests. The
 * global is therefore CHECKED rather than left to a `ReferenceError` from inside
 * the framework.
 */
export class LankaWebSocketTransport
	extends ALankaStreamTransport
	implements ILankaWebSocketChannel
{
	private readonly socketConfig: ILankaWebSocketConfig;
	private readonly readFrame: TLankaWebSocketFrameReader;
	private readonly writeFrame: TLankaWebSocketFrameWriter;
	private readonly outbox: string[] = [];

	private socket: WebSocket | null = null;
	private wire: ILankaStreamTransportHandlers | null = null;
	private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
	private silenceTimer: ReturnType<typeof setTimeout> | null = null;

	public constructor(config: ILankaWebSocketConfig = {}) {
		super(config);
		this.socketConfig = config;
		this.readFrame = config.readFrame ?? readDefaultFrame;
		this.writeFrame = config.writeFrame ?? writeDefaultFrame;
	}

	public override isSupported(): boolean {
		return typeof WebSocket === "function";
	}

	public isOpen(): boolean {
		return this.socket?.readyState === 1;
	}

	/**
	 * Gives the connection up, and throws away what was held for it.
	 *
	 * The outbox survives a DROPPED link on purpose — that is the whole reason it
	 * exists. It must not survive this one: an explicit disconnect is a sign-out
	 * or a screen closing, and a message held for "the next connection" would go
	 * out as whoever signs in next.
	 */
	public override disconnect(): void {
		this.outbox.length = 0;
		super.disconnect();
	}

	/** Sends a named message. `false` means it was queued, or dropped. */
	public send(eventType: string, payload: Record<string, unknown> = {}): boolean {
		const frame = this.writeFrame(eventType, payload);
		if (this.isOpen()) {
			this.socket?.send(frame);
			return true;
		}

		this.hold(frame);
		return false;
	}

	protected open(handlers: ILankaStreamTransportHandlers): void {
		this.wire = handlers;

		const socket = new WebSocket(
			this.address(),
			this.socketConfig.protocols as string | string[],
		);
		this.socket = socket;

		socket.onopen = () => {
			this.flush();
			this.startHeartbeat();
			handlers.opened();
		};
		socket.onmessage = (event: MessageEvent) => {
			this.accept(event.data);
		};
		socket.onerror = () => {
			this.reportLoss();
		};
		socket.onclose = () => {
			this.reportLoss();
		};
	}

	protected close(): void {
		this.stopHeartbeat();
		const socket = this.socket;
		this.socket = null;
		// Never null in practice — the base calls this at most once, and only for a
		// connection `open` finished building. Kept because the alternative is a
		// non-null assertion, which would turn a contract into a claim.
		if (!socket) return;

		// The handlers are detached first: `close()` fires `onclose`, and a loss
		// reported from inside an explicit disconnect would schedule a reconnect
		// against a connection the application just gave up.
		socket.onopen = null;
		socket.onmessage = null;
		socket.onerror = null;
		socket.onclose = null;
		socket.close();
	}

	private address(): string {
		if (this.socketConfig.url) return this.socketConfig.url;

		const base = getLankaHost().apiBaseUrl.replace(/\/+$/, "");
		const path = this.socketConfig.path ?? "/ws";
		const suffix = path.startsWith("/") ? path : `/${path}`;

		// `http` and `https` map to `ws` and `wss`; anything else — a bare path, an
		// address already given as `ws://` — is left as written. Rewriting a scheme
		// the package does not recognise is guessing at somebody's deployment.
		return `${base.replace(/^http(s?):\/\//, "ws$1://")}${suffix}`;
	}

	private accept(raw: unknown): void {
		// Any traffic proves the link is alive, an unrecognised frame included: the
		// heartbeat asks whether the peer is there, not whether it is polite.
		this.heardFromPeer();
		if (typeof raw !== "string") return;

		const message = this.readFrame(raw);
		if (message) this.wire?.received(message.type, message.payload);
	}

	private hold(frame: string): void {
		if (this.socketConfig.queueWhileClosed === false) return;

		const limit = this.socketConfig.maxQueuedMessages ?? 50;
		this.outbox.push(frame);
		// The OLDEST goes: on a link that has been down a while, the newest messages
		// are the ones still worth sending.
		while (this.outbox.length > limit) this.outbox.shift();
	}

	private flush(): void {
		const held = this.outbox.splice(0, this.outbox.length);
		for (const frame of held) this.socket?.send(frame);
	}

	private startHeartbeat(): void {
		const every = this.socketConfig.heartbeatMs;
		if (!every) return;

		// The previous one first: a socket that reports `open` twice would leave an
		// interval nothing holds a handle to, pinging forever on a dead connection.
		this.stopHeartbeat();
		this.heartbeatTimer = setInterval(() => {
			this.send(this.socketConfig.heartbeatEventType ?? "ping");
			this.expectAnswer();
		}, every);
	}

	private expectAnswer(): void {
		if (this.silenceTimer) return;

		this.silenceTimer = setTimeout(() => {
			// Nothing at all came back within the window: the socket may still say
			// `OPEN` and there is nobody on the other end of it.
			this.silenceTimer = null;
			this.reportLoss();
		}, this.socketConfig.heartbeatTimeoutMs ?? this.socketConfig.heartbeatMs);
	}

	private heardFromPeer(): void {
		if (!this.silenceTimer) return;

		clearTimeout(this.silenceTimer);
		this.silenceTimer = null;
	}

	private stopHeartbeat(): void {
		if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
		this.heartbeatTimer = null;
		this.heardFromPeer();
	}

	/**
	 * Says the link is gone.
	 *
	 * `error` and `close` both reach this on one dropped socket, and the silence
	 * timer is a third way in. None of them is deduplicated here: the base ignores
	 * a loss for a connection it already wrote off, which is a guarantee every
	 * transport gets rather than one this class remembers.
	 */
	private reportLoss(): void {
		this.stopHeartbeat();
		this.wire?.lost();
	}
}
