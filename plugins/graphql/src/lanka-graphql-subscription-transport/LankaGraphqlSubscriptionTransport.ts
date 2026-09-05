import { getLankaHost } from "lanka/config";
import {
	ALankaStreamTransport,
	type ILankaStreamConfig,
	type ILankaStreamTransportHandlers,
} from "lanka/stream";
import type { ILankaGraphqlOperation } from "../_interfaces/ILankaGraphqlOperation";
import type { ILankaGraphqlError } from "../lanka-graphql-request/LankaGraphqlRequest";
import { readLankaGraphqlDocument } from "../read-lanka-graphql-document/readLankaGraphqlDocument";

/** The socket this transport talks over, reduced to what it uses. */
export interface ILankaGraphqlSubscriptionSocket {
	send: (frame: string) => void;
	close: () => void;
}

/** What the transport wants told about a socket it did not open itself. */
export interface ILankaGraphqlSocketEvents {
	onOpen: () => void;
	onFrame: (raw: unknown) => void;
	onClosed: () => void;
}

/** Opens a socket and reports through the events. */
export type TLankaGraphqlSocketOpener = (
	url: string,
	events: ILankaGraphqlSocketEvents,
) => ILankaGraphqlSubscriptionSocket;

export interface ILankaGraphqlSubscriptionConfig extends ILankaStreamConfig {
	/**
	 * One operation per named event, which is the whole mapping.
	 *
	 * A bridge subscribes to `"todo.completed"`; this says which document that is.
	 * The indirection is what lets a subscription and a server-sent event reach a
	 * scenario through identical code.
	 */
	operations?: Record<string, ILankaGraphqlOperation>;
	/** Socket path relative to `host.apiBaseUrl`. Defaults to `/graphql`. */
	path?: string;
	/** The whole address, when the socket is not under the API base at all. */
	url?: string;
	/**
	 * What goes in `connection_init` — an auth token, most of the time.
	 *
	 * A function rather than a value: a token read once at construction is the
	 * token the application had on the sign-in screen, and every reconnect after
	 * an hour would present an expired one.
	 */
	connectionParams?: () => Record<string, unknown> | Promise<Record<string, unknown>>;
	/**
	 * How long to wait for `connection_ack`. Defaults to 10 seconds.
	 *
	 * Without it, a socket that upgrades and never acknowledges leaves the
	 * transport connected-but-useless: nothing arrives, nothing errors, and the
	 * reconnect ladder never starts because nothing said the link was lost.
	 */
	connectionAckTimeoutMs?: number;
	/** A subscription the server refused, or that failed while running. */
	onOperationError?: (eventType: string, errors: readonly ILankaGraphqlError[]) => void;
	/** Opens the socket. Defaults to a `WebSocket` on the `graphql-transport-ws` subprotocol. */
	openSocket?: TLankaGraphqlSocketOpener;
}

/** The subprotocol every `graphql-ws` server negotiates. */
const SUBPROTOCOL = "graphql-transport-ws";

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const errorsOf = (payload: unknown): readonly ILankaGraphqlError[] =>
	Array.isArray(payload) ? (payload as ILankaGraphqlError[]) : [];

const openWebSocket: TLankaGraphqlSocketOpener = (url, events) => {
	const socket = new WebSocket(url, SUBPROTOCOL);
	socket.onopen = () => events.onOpen();
	socket.onmessage = (event: MessageEvent) => events.onFrame(event.data);
	socket.onerror = () => events.onClosed();
	socket.onclose = () => events.onClosed();

	return {
		send: (frame) => socket.send(frame),
		close: () => {
			socket.onopen = null;
			socket.onmessage = null;
			socket.onerror = null;
			socket.onclose = null;
			socket.close();
		},
	};
};

/**
 * GraphQL subscriptions as a stream transport.
 *
 * Speaks the `graphql-transport-ws` protocol — `connection_init` /
 * `connection_ack`, one `subscribe` per operation, `next` / `error` /
 * `complete`, `ping` / `pong` — and hands what arrives to the same bridges a
 * server-sent stream would. Nothing above this class knows it is on GraphQL.
 *
 * ## Why the mapping is event type -> operation
 *
 * `graphql-ws` multiplexes by an id per subscription, and an id is meaningless
 * to a bridge. `operations` names each subscription, so the layer above
 * subscribes to `"todo.completed"` whether the wire is this, SSE or a socket —
 * which is the only reason the protocol can be changed without touching a
 * screen.
 *
 * ## Re-subscribing is not optional
 *
 * The far end forgets every subscription when the connection drops. The base
 * calls `subscribeTo` for each wanted event type as soon as the link is usable,
 * and "usable" here means ACKNOWLEDGED, not merely upgraded — a `subscribe` sent
 * before `connection_ack` is answered with `4401` by a conforming server, and
 * the reconnect ladder then loops against a socket that is working.
 *
 * ## What is deliberately absent
 *
 * A cache, a document store and fragment handling. This is a transport: it
 * carries frames to bridges, and a ViewModel already owns the state a screen
 * reads.
 */
export class LankaGraphqlSubscriptionTransport extends ALankaStreamTransport {
	private readonly subscriptionConfig: ILankaGraphqlSubscriptionConfig;
	private readonly opener: TLankaGraphqlSocketOpener;
	/** Live subscription id -> the event type it carries. */
	private readonly carried = new Map<string, string>();
	/** Event type -> its live subscription id. */
	private readonly ids = new Map<string, string>();

	private socket: ILankaGraphqlSubscriptionSocket | null = null;
	private wire: ILankaStreamTransportHandlers | null = null;
	private ackTimer: ReturnType<typeof setTimeout> | null = null;
	private acknowledged = false;
	private nextId = 0;

	public constructor(config: ILankaGraphqlSubscriptionConfig = {}) {
		super(config);
		this.subscriptionConfig = config;
		this.opener = config.openSocket ?? openWebSocket;
	}

	public override isSupported(): boolean {
		// A custom opener says the application brought its own socket, and this
		// engine's globals stop being the question.
		return Boolean(this.subscriptionConfig.openSocket) || typeof WebSocket === "function";
	}

	protected open(handlers: ILankaStreamTransportHandlers): void {
		this.wire = handlers;
		this.acknowledged = false;

		this.socket = this.opener(this.address(), {
			onOpen: () => {
				this.initialise();
			},
			onFrame: (raw) => {
				this.accept(raw);
			},
			onClosed: () => {
				this.reportLoss();
			},
		});
	}

	protected close(): void {
		this.clearAckTimer();
		this.acknowledged = false;
		this.carried.clear();
		this.ids.clear();

		const socket = this.socket;
		this.socket = null;
		socket?.close();
	}

	protected override subscribeTo(eventType: string): void {
		// Before the acknowledgement there is nothing to subscribe on. The base
		// calls this again for every wanted type the moment the ack arrives, so
		// nothing is lost by refusing now.
		if (!this.acknowledged) return;

		const operation = this.subscriptionConfig.operations?.[eventType];
		if (!operation || this.ids.has(eventType)) return;

		const id = String((this.nextId += 1));
		this.ids.set(eventType, id);
		this.carried.set(id, eventType);
		this.send({
			id,
			type: "subscribe",
			payload: {
				query: readLankaGraphqlDocument(operation.document),
				variables: operation.variables,
				operationName: operation.operationName,
			},
		});
	}

	protected override unsubscribeFrom(eventType: string): void {
		const id = this.ids.get(eventType);
		if (id === undefined) return;

		this.ids.delete(eventType);
		this.carried.delete(id);
		if (this.acknowledged) this.send({ id, type: "complete" });
	}

	private address(): string {
		if (this.subscriptionConfig.url) return this.subscriptionConfig.url;

		const base = getLankaHost().apiBaseUrl.replace(/\/+$/, "");
		const path = this.subscriptionConfig.path ?? "/graphql";
		const suffix = path.startsWith("/") ? path : `/${path}`;

		return `${base.replace(/^http(s?):\/\//, "ws$1://")}${suffix}`;
	}

	/**
	 * Sends the handshake, awaiting the parameters only when there are some.
	 *
	 * Not `async` throughout, deliberately. An `await` on nothing still costs a
	 * microtask, and that microtask is a window in which the socket is open and
	 * has said nothing — which a server with a short handshake deadline can act
	 * on. Where the parameters ARE a promise the window is unavoidable and honest:
	 * a token refresh is a network call.
	 */
	private initialise(): void {
		const params = this.subscriptionConfig.connectionParams?.();

		if (params && typeof (params as PromiseLike<unknown>).then === "function") {
			void (params as Promise<Record<string, unknown>>).then((resolved) => {
				this.handshake(resolved);
			});
			return;
		}

		this.handshake(params as Record<string, unknown> | undefined);
	}

	private handshake(payload: Record<string, unknown> | undefined): void {
		// The socket may have gone while the parameters were being fetched, and
		// sending into a closed one throws.
		if (!this.socket) return;

		this.send({ type: "connection_init", payload });
		this.ackTimer = setTimeout(() => {
			this.ackTimer = null;
			this.reportLoss();
		}, this.subscriptionConfig.connectionAckTimeoutMs ?? 10_000);
	}

	private accept(raw: unknown): void {
		if (typeof raw !== "string") return;

		let frame: unknown;
		try {
			frame = JSON.parse(raw);
		} catch {
			return;
		}
		if (!isRecord(frame) || typeof frame.type !== "string") return;

		this.handle(frame.type, frame);
	}

	private handle(type: string, frame: Record<string, unknown>): void {
		if (type === "connection_ack") {
			this.acknowledge();
			return;
		}
		if (type === "ping") {
			this.send({ type: "pong" });
			return;
		}
		if (type === "next") {
			this.deliver(frame);
			return;
		}
		if (type === "error") {
			this.refuse(frame);
			return;
		}
		if (type === "complete") this.releaseSubscription(frame);
	}

	private acknowledge(): void {
		this.clearAckTimer();
		this.acknowledged = true;
		// The base answers by calling `subscribeTo` for every wanted event type,
		// which is what re-establishes the subscriptions the far end forgot.
		this.wire?.opened();
	}

	private deliver(frame: Record<string, unknown>): void {
		const eventType = this.eventTypeOf(frame);
		if (!eventType) return;

		const payload = isRecord(frame.payload) ? frame.payload.data : undefined;
		if (isRecord(payload)) this.wire?.received(eventType, payload);
	}

	private refuse(frame: Record<string, unknown>): void {
		const eventType = this.eventTypeOf(frame);
		if (!eventType) return;

		// An `error` frame ENDS the subscription: the id is dead, and holding it
		// would stop the next `subscribeTo` from asking again after a reconnect.
		this.releaseSubscription(frame);
		this.subscriptionConfig.onOperationError?.(eventType, errorsOf(frame.payload));
	}

	private releaseSubscription(frame: Record<string, unknown>): void {
		const id = typeof frame.id === "string" ? frame.id : null;
		if (id === null) return;

		const eventType = this.carried.get(id);
		this.carried.delete(id);
		if (eventType !== undefined) this.ids.delete(eventType);
	}

	private eventTypeOf(frame: Record<string, unknown>): string | undefined {
		const id = typeof frame.id === "string" ? frame.id : null;
		return id === null ? undefined : this.carried.get(id);
	}

	private send(frame: Record<string, unknown>): void {
		this.socket?.send(JSON.stringify(frame));
	}

	private clearAckTimer(): void {
		if (!this.ackTimer) return;

		clearTimeout(this.ackTimer);
		this.ackTimer = null;
	}

	/**
	 * Says the link is gone.
	 *
	 * `error`, `close` and the unanswered handshake all reach this. None of them
	 * is deduplicated here: the base ignores a loss for a connection it already
	 * wrote off, which is a guarantee every transport gets rather than one this
	 * class remembers.
	 */
	private reportLoss(): void {
		this.clearAckTimer();
		this.wire?.lost();
	}
}
