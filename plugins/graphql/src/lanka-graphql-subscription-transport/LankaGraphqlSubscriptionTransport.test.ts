import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLanka } from "lanka";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import {
	LankaGraphqlSubscriptionTransport,
	type ILankaGraphqlSocketEvents,
	type ILankaGraphqlSubscriptionConfig,
} from "./LankaGraphqlSubscriptionTransport";

/**
 * The `graphql-ws` protocol.
 *
 * The playground drives the happy path through a plugin and a bridge. What is
 * pinned here is the protocol itself — the address, the handshake parameters,
 * unsubscribing, and every frame a server can send that a hand-written client
 * forgets about.
 */

class FakeSocket {
	public static instances: FakeSocket[] = [];

	public closed = false;
	public readonly sent: Record<string, unknown>[] = [];

	public readonly url: string;

	private readonly events: ILankaGraphqlSocketEvents;

	public constructor(url: string, events: ILankaGraphqlSocketEvents) {
		this.url = url;
		this.events = events;
		FakeSocket.instances.push(this);
	}

	public send(frame: string): void {
		this.sent.push(JSON.parse(frame) as Record<string, unknown>);
	}

	public close(): void {
		this.closed = true;
	}

	public accept(): void {
		this.events.onOpen();
	}

	public acknowledge(): void {
		this.events.onFrame(JSON.stringify({ type: "connection_ack" }));
	}

	public deliver(frame: Record<string, unknown>): void {
		this.events.onFrame(JSON.stringify(frame));
	}

	public deliverRaw(raw: unknown): void {
		this.events.onFrame(raw);
	}

	public drop(): void {
		this.events.onClosed();
	}

	public framesOf(type: string): Record<string, unknown>[] {
		return this.sent.filter((frame) => frame.type === type);
	}
}

const lastSocket = (): FakeSocket => {
	const socket = FakeSocket.instances.at(-1);
	if (!socket) throw new Error("no connection was opened");
	return socket;
};

const openTransport = (
	config: ILankaGraphqlSubscriptionConfig = {},
): LankaGraphqlSubscriptionTransport => {
	const transport = new LankaGraphqlSubscriptionTransport({
		openSocket: (url, events) => new FakeSocket(url, events),
		...config,
	});
	transport.connect();
	lastSocket().accept();
	return transport;
};

const WATCH = { document: `subscription { todoCompleted { id } }` };

beforeEach(() => {
	createLanka({ host: { ...lankaTestHost, apiBaseUrl: "https://api.test/v1/" } });
	FakeSocket.instances = [];
});

afterEach(() => {
	vi.useRealTimers();
});

describe("the address", () => {
	it("comes from the host, with the scheme upgraded", () => {
		openTransport();

		expect(lastSocket().url).toBe("wss://api.test/v1/graphql");
	});

	it("keeps a path the application wrote", () => {
		openTransport({ path: "subscriptions" });

		expect(lastSocket().url).toBe("wss://api.test/v1/subscriptions");
	});

	it("is taken whole when the socket lives somewhere else", () => {
		openTransport({ url: "ws://realtime.test/graphql" });

		expect(lastSocket().url).toBe("ws://realtime.test/graphql");
	});
});

describe("the handshake", () => {
	it("goes out with no parameters when there are none", () => {
		openTransport();

		expect(lastSocket().sent).toEqual([{ type: "connection_init" }]);
	});

	it("carries what the application put in it", () => {
		openTransport({ connectionParams: () => ({ authorization: "Bearer t" }) });

		expect(lastSocket().sent[0]).toEqual({
			type: "connection_init",
			payload: { authorization: "Bearer t" },
		});
	});

	it("waits for parameters that have to be fetched", async () => {
		// A token refresh is a network call, and the window it opens is honest.
		openTransport({
			connectionParams: () => Promise.resolve({ authorization: "Bearer fresh" }),
		});
		expect(lastSocket().sent).toEqual([]);

		await Promise.resolve();

		expect(lastSocket().sent[0]).toEqual({
			type: "connection_init",
			payload: { authorization: "Bearer fresh" },
		});
	});

	it("sends nothing when the socket went while the parameters were fetched", async () => {
		const transport = openTransport({
			connectionParams: () => Promise.resolve({ authorization: "Bearer t" }),
		});
		const socket = lastSocket();

		transport.disconnect();
		await Promise.resolve();

		expect(socket.sent).toEqual([]);
	});

	it("is treated as a lost link when it is never acknowledged", async () => {
		vi.useFakeTimers();
		openTransport({ connectionAckTimeoutMs: 500 });

		await vi.advanceTimersByTimeAsync(500);
		await vi.advanceTimersByTimeAsync(1000);

		expect(FakeSocket.instances).toHaveLength(2);
	});

	it("stops the timeout once the acknowledgement arrives", async () => {
		vi.useFakeTimers();
		openTransport({ connectionAckTimeoutMs: 500 });

		lastSocket().acknowledge();
		await vi.advanceTimersByTimeAsync(60_000);

		expect(FakeSocket.instances).toHaveLength(1);
	});
});

describe("subscribing", () => {
	it("waits for the acknowledgement", () => {
		// A conforming server answers `4401` to a `subscribe` that arrives first,
		// and the ladder then loops against a socket that is working.
		const transport = openTransport({ operations: { "todo.completed": WATCH } });
		transport.on("todo.completed", vi.fn());

		expect(lastSocket().framesOf("subscribe")).toEqual([]);

		lastSocket().acknowledge();

		expect(lastSocket().framesOf("subscribe")).toHaveLength(1);
	});

	it("sends the document and its variables", () => {
		const transport = openTransport({
			operations: {
				"todo.completed": { ...WATCH, variables: { board: 1 }, operationName: "Watch" },
			},
		});
		transport.on("todo.completed", vi.fn());
		lastSocket().acknowledge();

		expect(lastSocket().framesOf("subscribe")[0]?.payload).toEqual({
			query: WATCH.document,
			variables: { board: 1 },
			operationName: "Watch",
		});
	});

	it("says nothing about an event type it has no operation for", () => {
		// A bridge may subscribe to something this transport does not carry — a
		// second transport might — and inventing a document for it is not an option.
		const transport = openTransport({ operations: {} });
		transport.on("todo.completed", vi.fn());
		lastSocket().acknowledge();

		expect(lastSocket().framesOf("subscribe")).toEqual([]);
	});

	it("subscribes once however many callers want the same event", () => {
		const transport = openTransport({ operations: { "todo.completed": WATCH } });
		lastSocket().acknowledge();

		transport.on("todo.completed", vi.fn());
		transport.on("todo.completed", vi.fn());

		expect(lastSocket().framesOf("subscribe")).toHaveLength(1);
	});

	it("completes the subscription when the last caller goes", () => {
		const transport = openTransport({ operations: { "todo.completed": WATCH } });
		lastSocket().acknowledge();
		const stop = transport.on("todo.completed", vi.fn());

		stop();

		expect(lastSocket().framesOf("complete")).toHaveLength(1);
	});

	it("can subscribe again after unsubscribing", () => {
		const transport = openTransport({ operations: { "todo.completed": WATCH } });
		lastSocket().acknowledge();
		transport.on("todo.completed", vi.fn())();

		transport.on("todo.completed", vi.fn());

		expect(lastSocket().framesOf("subscribe")).toHaveLength(2);
	});
});

describe("what the server sends", () => {
	const subscribed = () => {
		const heard = vi.fn();
		const transport = openTransport({ operations: { "todo.completed": WATCH } });
		lastSocket().acknowledge();
		transport.on("todo.completed", heard);
		const id = String(lastSocket().framesOf("subscribe")[0]?.id);

		return { transport, heard, id };
	};

	it("delivers the subscription's data", () => {
		const { heard, id } = subscribed();

		lastSocket().deliver({
			id,
			type: "next",
			payload: { data: { todoCompleted: { id: "7" } } },
		});

		expect(heard).toHaveBeenCalledWith({ todoCompleted: { id: "7" } });
	});

	it("drops a frame for an id it does not know", () => {
		// A late frame for a subscription already completed, or one belonging to
		// another client on a shared socket.
		const { heard } = subscribed();

		lastSocket().deliver({ id: "999", type: "next", payload: { data: { x: 1 } } });

		expect(heard).not.toHaveBeenCalled();
	});

	it("drops a frame carrying no data", () => {
		const { heard, id } = subscribed();

		lastSocket().deliver({ id, type: "next", payload: {} });

		expect(heard).not.toHaveBeenCalled();
	});

	it("answers a ping", () => {
		// A server that gets no pong hangs up, and the ladder then reconnects
		// forever against a connection that was fine.
		subscribed();

		lastSocket().deliver({ type: "ping" });

		expect(lastSocket().framesOf("pong")).toHaveLength(1);
	});

	it("reports a subscription the server refused", () => {
		const onOperationError = vi.fn();
		const transport = openTransport({
			operations: { "todo.completed": WATCH },
			onOperationError,
		});
		lastSocket().acknowledge();
		transport.on("todo.completed", vi.fn());
		const id = String(lastSocket().framesOf("subscribe")[0]?.id);

		lastSocket().deliver({ id, type: "error", payload: [{ message: "not allowed" }] });

		expect(onOperationError).toHaveBeenCalledWith("todo.completed", [
			{ message: "not allowed" },
		]);
	});

	it("reports a refusal even when the payload is not a list", () => {
		const onOperationError = vi.fn();
		const transport = openTransport({
			operations: { "todo.completed": WATCH },
			onOperationError,
		});
		lastSocket().acknowledge();
		transport.on("todo.completed", vi.fn());
		const id = String(lastSocket().framesOf("subscribe")[0]?.id);

		lastSocket().deliver({ id, type: "error", payload: { message: "malformed" } });

		expect(onOperationError).toHaveBeenCalledWith("todo.completed", []);
	});

	it("forgets a subscription the server ended, so a reconnect asks again", async () => {
		// Holding the dead id would make the next `subscribeTo` a no-op, and the
		// screen would be connected, quiet and permanently wrong.
		vi.useFakeTimers();
		const { id } = subscribed();

		lastSocket().deliver({ id, type: "complete" });
		lastSocket().drop();
		await vi.advanceTimersByTimeAsync(1000);
		lastSocket().accept();
		lastSocket().acknowledge();

		expect(lastSocket().framesOf("subscribe")).toHaveLength(1);
	});

	it("ignores a complete with no id", () => {
		subscribed();

		expect(() => lastSocket().deliver({ type: "complete" })).not.toThrow();
	});

	it("ignores a frame that is not text", () => {
		const { heard } = subscribed();

		lastSocket().deliverRaw(new ArrayBuffer(4));

		expect(heard).not.toHaveBeenCalled();
	});

	it("ignores a frame that is not JSON", () => {
		const { heard } = subscribed();

		lastSocket().deliverRaw("<html>a proxy answered");

		expect(heard).not.toHaveBeenCalled();
	});

	it("ignores a frame with no type", () => {
		const { heard } = subscribed();

		lastSocket().deliver({ id: "1", payload: {} });

		expect(heard).not.toHaveBeenCalled();
	});

	it("ignores a frame type the protocol grew after this was written", () => {
		const { heard } = subscribed();

		expect(() => lastSocket().deliver({ type: "something_new" })).not.toThrow();
		expect(heard).not.toHaveBeenCalled();
	});
});

describe("losing the socket", () => {
	it("reports it once, however many ways the socket says so", async () => {
		vi.useFakeTimers();
		openTransport();
		const socket = lastSocket();

		socket.drop();
		socket.drop();
		await vi.advanceTimersByTimeAsync(1000);

		expect(FakeSocket.instances).toHaveLength(2);
	});

	it("closes what it opened, and forgets every subscription", async () => {
		vi.useFakeTimers();
		const transport = openTransport({ operations: { "todo.completed": WATCH } });
		lastSocket().acknowledge();
		transport.on("todo.completed", vi.fn());
		const first = lastSocket();

		first.drop();
		await vi.advanceTimersByTimeAsync(1000);
		lastSocket().accept();
		lastSocket().acknowledge();

		expect(first.closed).toBe(true);
		// Asked for again on the new socket: the far end forgot all of them.
		expect(lastSocket().framesOf("subscribe")).toHaveLength(1);
	});
});

describe("support", () => {
	it("is whatever the engine says, when the socket is the platform's", () => {
		vi.stubGlobal("WebSocket", undefined);
		try {
			expect(new LankaGraphqlSubscriptionTransport().isSupported()).toBe(false);
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it("stops being the engine's question once the application brought a socket", () => {
		vi.stubGlobal("WebSocket", undefined);
		try {
			const transport = new LankaGraphqlSubscriptionTransport({
				openSocket: (url, events) => new FakeSocket(url, events),
			});

			expect(transport.isSupported()).toBe(true);
		} finally {
			vi.unstubAllGlobals();
		}
	});
});

describe("the socket the package opens for itself", () => {
	class NativeSocket {
		public static last: NativeSocket | null = null;

		public onopen: (() => void) | null = null;
		public onmessage: ((event: MessageEvent) => void) | null = null;
		public onerror: (() => void) | null = null;
		public onclose: (() => void) | null = null;
		public closed = false;
		public readonly sent: string[] = [];

		public readonly url: string;
		public readonly protocol: string | undefined;

		public constructor(url: string, protocol?: string) {
			this.url = url;
			this.protocol = protocol;
			NativeSocket.last = this;
		}

		public send(frame: string): void {
			this.sent.push(frame);
		}

		public close(): void {
			this.closed = true;
		}
	}

	it("negotiates the subprotocol every graphql-ws server expects", () => {
		// Without it a conforming server closes the connection during the
		// handshake, and the failure reads as a network problem.
		vi.stubGlobal("WebSocket", NativeSocket);
		try {
			new LankaGraphqlSubscriptionTransport().connect();

			expect(NativeSocket.last?.protocol).toBe("graphql-transport-ws");
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it("carries the handshake, the frames and the loss through the same three events", async () => {
		vi.stubGlobal("WebSocket", NativeSocket);
		vi.useFakeTimers();
		try {
			const transport = new LankaGraphqlSubscriptionTransport({
				operations: { "todo.completed": WATCH },
			});
			const heard = vi.fn();
			transport.on("todo.completed", heard);
			transport.connect();

			const socket = NativeSocket.last;
			socket?.onopen?.();
			expect(socket?.sent[0]).toContain("connection_init");

			socket?.onmessage?.({
				data: JSON.stringify({ type: "connection_ack" }),
			} as MessageEvent);
			const id = String((JSON.parse(socket?.sent[1] ?? "{}") as { id?: string }).id ?? "");
			socket?.onmessage?.({
				data: JSON.stringify({ id, type: "next", payload: { data: { todoCompleted: 1 } } }),
			} as MessageEvent);
			expect(heard).toHaveBeenCalledWith({ todoCompleted: 1 });

			socket?.onclose?.();
			await vi.advanceTimersByTimeAsync(1000);
			expect(socket?.closed).toBe(true);

			transport.disconnect();
		} finally {
			vi.unstubAllGlobals();
		}
	});
});
