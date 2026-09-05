import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLanka } from "lanka";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { LankaWebSocketTransport } from "./LankaWebSocketTransport";

/**
 * The WebSocket transport.
 *
 * The ladder underneath is `ALankaStreamTransport`'s and is pinned in core. What
 * is pinned here is what this wire adds: the address, the envelope, the outbox
 * and the heartbeat — the last one because a half-open socket is the failure
 * this protocol has and a server-sent stream does not.
 */

class FakeSocket {
	public static instances: FakeSocket[] = [];
	public static failConstruction = false;

	public onopen: (() => void) | null = null;
	public onerror: (() => void) | null = null;
	public onclose: (() => void) | null = null;
	public onmessage: ((event: MessageEvent) => void) | null = null;

	public readyState = 0;
	public readonly sent: string[] = [];

	public readonly url: string;
	public readonly protocols?: string | readonly string[];

	public constructor(url: string, protocols?: string | readonly string[]) {
		this.url = url;
		this.protocols = protocols;
		if (FakeSocket.failConstruction) throw new Error("the upgrade was refused");
		FakeSocket.instances.push(this);
	}

	public send(frame: string): void {
		this.sent.push(frame);
	}

	public close(): void {
		this.readyState = 3;
	}

	public accept(): void {
		this.readyState = 1;
		this.onopen?.();
	}

	public deliver(body: unknown): void {
		this.onmessage?.({ data: JSON.stringify(body) } as MessageEvent);
	}

	public framesOf(type: string): { type: string; payload: Record<string, unknown> }[] {
		return this.frames().filter((frame) => frame.type === type);
	}

	public frames(): { type: string; payload: Record<string, unknown> }[] {
		return this.sent.map(
			(frame) => JSON.parse(frame) as { type: string; payload: Record<string, unknown> },
		);
	}
}

const lastSocket = (): FakeSocket => {
	const socket = FakeSocket.instances.at(-1);
	if (!socket) throw new Error("no connection was opened");
	return socket;
};

const openTransport = (
	config: ConstructorParameters<typeof LankaWebSocketTransport>[0] = {},
): LankaWebSocketTransport => {
	const transport = new LankaWebSocketTransport(config);
	transport.connect();
	lastSocket().accept();
	return transport;
};

beforeEach(() => {
	createLanka({ host: { ...lankaTestHost, apiBaseUrl: "https://api.test/v1/" } });
	FakeSocket.instances = [];
	FakeSocket.failConstruction = false;
	vi.stubGlobal("WebSocket", FakeSocket);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("the address", () => {
	it("comes from the host, with the scheme upgraded", () => {
		// Reading a build-time global would mean knowing the consumer's bundler and
		// the name of a variable in their environment.
		new LankaWebSocketTransport().connect();

		expect(lastSocket().url).toBe("wss://api.test/v1/ws");
	});

	it("keeps a path the application wrote", () => {
		new LankaWebSocketTransport({ path: "live" }).connect();

		expect(lastSocket().url).toBe("wss://api.test/v1/live");
	});

	it("is taken whole when the socket lives somewhere else", () => {
		// A socket often has its own host, and deriving one address from the other
		// would be a guess this package cannot check.
		new LankaWebSocketTransport({ url: "ws://sockets.test/room" }).connect();

		expect(lastSocket().url).toBe("ws://sockets.test/room");
	});

	it("offers the subprotocols it was given", () => {
		new LankaWebSocketTransport({ protocols: ["v2.chat"] }).connect();

		expect(lastSocket().protocols).toEqual(["v2.chat"]);
	});
});

describe("support", () => {
	it("reports none, and does not throw, on an engine without WebSocket", () => {
		// Absent support is not a failure: every screen keeps working because the
		// same data arrives through ordinary requests.
		vi.stubGlobal("WebSocket", undefined);
		const transport = new LankaWebSocketTransport();

		transport.connect();

		expect(transport.isSupported()).toBe(false);
		expect(transport.isOpen()).toBe(false);
	});

	it("does not loop when the upgrade is refused outright", async () => {
		vi.useFakeTimers();
		try {
			FakeSocket.failConstruction = true;
			new LankaWebSocketTransport().connect();

			await vi.advanceTimersByTimeAsync(60_000);

			expect(FakeSocket.instances).toHaveLength(0);
		} finally {
			vi.useRealTimers();
		}
	});
});

describe("the envelope", () => {
	it("reads a wrapped frame", () => {
		const transport = openTransport();
		const heard = vi.fn();
		transport.on("gap.updated", heard);

		lastSocket().deliver({ type: "gap.updated", payload: { id: 7 } });

		expect(heard).toHaveBeenCalledWith({ id: 7 });
	});

	it("reads a flat frame", () => {
		const transport = openTransport();
		const heard = vi.fn();
		transport.on("gap.updated", heard);

		lastSocket().deliver({ type: "gap.updated", id: 7 });

		expect(heard).toHaveBeenCalledWith({ id: 7 });
	});

	it("accepts `trigger` as a second spelling of `type`", () => {
		const transport = openTransport();
		const heard = vi.fn();
		transport.on("gap.updated", heard);

		lastSocket().deliver({ trigger: "gap.updated", payload: { id: 7 } });

		expect(heard).toHaveBeenCalledWith({ id: 7 });
	});

	it("drops a frame with no name in it", () => {
		const transport = openTransport();
		const heard = vi.fn();
		transport.on("gap.updated", heard);

		lastSocket().deliver({ id: 7 });

		expect(heard).not.toHaveBeenCalled();
	});

	it("drops a frame that is not JSON", () => {
		const transport = openTransport();
		const heard = vi.fn();
		transport.on("gap.updated", heard);

		lastSocket().onmessage?.({ data: "<html>a proxy answered" } as MessageEvent);

		expect(heard).not.toHaveBeenCalled();
	});

	it("drops a frame that is not text", () => {
		const transport = openTransport();
		const heard = vi.fn();
		transport.on("gap.updated", heard);

		lastSocket().onmessage?.({ data: new ArrayBuffer(4) } as MessageEvent);

		expect(heard).not.toHaveBeenCalled();
	});

	it("is replaceable whole, for a protocol somebody else designed", () => {
		const transport = openTransport({
			readFrame: (raw) => ({ type: "gap.updated", payload: { line: raw } }),
			writeFrame: (eventType, payload) => `${eventType}|${String(payload.id)}`,
		});
		const heard = vi.fn();
		transport.on("gap.updated", heard);

		lastSocket().onmessage?.({ data: "not json at all" } as MessageEvent);
		transport.send("gap.seen", { id: 7 });

		expect(heard).toHaveBeenCalledWith({ line: "not json at all" });
		expect(lastSocket().sent).toEqual(["gap.seen|7"]);
	});
});

describe("sending", () => {
	it("reports that an open socket took it", () => {
		const transport = openTransport();

		expect(transport.send("gap.seen", { id: 7 })).toBe(true);
		expect(lastSocket().frames()).toEqual([{ type: "gap.seen", payload: { id: 7 } }]);
	});

	it("reports that a closed one did not, and holds it", () => {
		// A caller whose message expires — a keystroke, a cursor position — branches
		// on the answer; one that does not can ignore it, which is why this is not a
		// rejection.
		const transport = new LankaWebSocketTransport();
		transport.connect();

		expect(transport.send("gap.seen", { id: 7 })).toBe(false);

		lastSocket().accept();
		expect(lastSocket().frames()).toEqual([{ type: "gap.seen", payload: { id: 7 } }]);
	});

	it("sends an empty payload when none was given", () => {
		const transport = openTransport();

		transport.send("gap.seen");

		expect(lastSocket().frames()).toEqual([{ type: "gap.seen", payload: {} }]);
	});

	it("holds nothing at all when queueing is off", () => {
		const transport = new LankaWebSocketTransport({ queueWhileClosed: false });
		transport.connect();

		transport.send("gap.seen", { id: 7 });
		lastSocket().accept();

		expect(lastSocket().sent).toEqual([]);
	});

	it("keeps the newest when the outbox is full", () => {
		const transport = new LankaWebSocketTransport({ maxQueuedMessages: 1 });
		transport.connect();

		transport.send("gap.seen", { id: 1 });
		transport.send("gap.seen", { id: 2 });
		lastSocket().accept();

		expect(lastSocket().frames()).toEqual([{ type: "gap.seen", payload: { id: 2 } }]);
	});

	it("flushes the outbox exactly once", () => {
		const transport = new LankaWebSocketTransport();
		transport.connect();
		transport.send("gap.seen", { id: 1 });

		lastSocket().accept();
		lastSocket().onopen?.();

		expect(lastSocket().sent).toHaveLength(1);
	});

	it("survives a dropped link, and is flushed to the connection that replaces it", async () => {
		// The whole reason the outbox exists: a reconnect is invisible from a
		// screen, and losing the click that happened during one is not a behaviour
		// anybody chose.
		vi.useFakeTimers();
		try {
			const transport = openTransport();
			lastSocket().onclose?.();

			transport.send("gap.seen", { id: 1 });
			await vi.advanceTimersByTimeAsync(1000);
			lastSocket().accept();

			expect(lastSocket().frames()).toEqual([{ type: "gap.seen", payload: { id: 1 } }]);
		} finally {
			vi.useRealTimers();
		}
	});

	it("is thrown away by an explicit disconnect", () => {
		// A dropped link and a SIGN-OUT are not the same event. Held across the
		// second, the message goes out as whoever signs in next.
		const transport = new LankaWebSocketTransport();
		transport.connect();
		transport.send("room.say", { text: "as the previous user" });

		transport.disconnect();
		transport.connect();
		lastSocket().accept();

		expect(lastSocket().sent).toEqual([]);
	});
});

describe("the heartbeat", () => {
	it("is off unless the backend is known to answer pings", () => {
		// One against a server that ignores them would close a connection that works.
		vi.useFakeTimers();
		try {
			openTransport();

			vi.advanceTimersByTime(60_000);

			expect(lastSocket().sent).toEqual([]);
		} finally {
			vi.useRealTimers();
		}
	});

	it("pings on the interval it was given", () => {
		vi.useFakeTimers();
		try {
			openTransport({ heartbeatMs: 1000 });

			vi.advanceTimersByTime(2000);

			expect(
				lastSocket()
					.frames()
					.map((frame) => frame.type),
			).toEqual(["ping", "ping"]);
		} finally {
			vi.useRealTimers();
		}
	});

	it("treats silence as a dropped link, and reconnects", async () => {
		// The failure this exists for: peer gone, socket still `OPEN`, nothing
		// arriving and nothing erroring — a screen quietly stale forever.
		vi.useFakeTimers();
		try {
			openTransport({ heartbeatMs: 1000, heartbeatTimeoutMs: 500 });

			await vi.advanceTimersByTimeAsync(1500);
			expect(FakeSocket.instances).toHaveLength(1);

			await vi.advanceTimersByTimeAsync(1000);
			expect(FakeSocket.instances).toHaveLength(2);
		} finally {
			vi.useRealTimers();
		}
	});

	it("counts any traffic as an answer", () => {
		// The question is whether the peer is there, not whether it is polite: a
		// backend that answers a ping with ordinary data has answered.
		vi.useFakeTimers();
		try {
			const transport = openTransport({ heartbeatMs: 1000, heartbeatTimeoutMs: 500 });
			transport.on("gap.updated", vi.fn());

			vi.advanceTimersByTime(1000);
			lastSocket().deliver({ type: "gap.updated", payload: {} });
			vi.advanceTimersByTime(600);

			expect(FakeSocket.instances).toHaveLength(1);
		} finally {
			vi.useRealTimers();
		}
	});

	it("stops when the connection is given up", () => {
		vi.useFakeTimers();
		try {
			const transport = openTransport({ heartbeatMs: 1000 });
			const socket = lastSocket();

			transport.disconnect();
			vi.advanceTimersByTime(5000);

			expect(socket.sent).toEqual([]);
		} finally {
			vi.useRealTimers();
		}
	});
});

describe("losing the link", () => {
	it("reports it once, however many ways the socket says so", async () => {
		// `error` and `close` both fire on a dropped connection, and two losses
		// would spend two rungs of the backoff for one failure.
		vi.useFakeTimers();
		try {
			openTransport();
			const socket = lastSocket();

			socket.onerror?.();
			socket.onclose?.();
			await vi.advanceTimersByTimeAsync(1000);

			expect(FakeSocket.instances).toHaveLength(2);
		} finally {
			vi.useRealTimers();
		}
	});

	it("an explicit disconnect does not look like a drop", async () => {
		// `close()` fires `onclose`. Treated as a loss it would reconnect the socket
		// the application just gave up.
		vi.useFakeTimers();
		try {
			const transport = openTransport();

			transport.disconnect();
			lastSocket().onclose?.();
			await vi.advanceTimersByTimeAsync(60_000);

			expect(FakeSocket.instances).toHaveLength(1);
		} finally {
			vi.useRealTimers();
		}
	});

	it("closes the socket and reports it shut", () => {
		const transport = openTransport();
		const socket = lastSocket();

		transport.disconnect();

		expect(socket.readyState).toBe(3);
		expect(transport.isOpen()).toBe(false);
	});
});

describe("the heartbeat across connections", () => {
	it("does not leave one running when the socket reports open twice", () => {
		// An interval nothing holds a handle to keeps pinging a dead connection,
		// and nothing above ever sees why the traffic is there.
		vi.useFakeTimers();
		try {
			const transport = openTransport({ heartbeatMs: 1000 });
			lastSocket().onopen?.();

			vi.advanceTimersByTime(1000);

			expect(lastSocket().framesOf("ping")).toHaveLength(1);
			transport.disconnect();
		} finally {
			vi.useRealTimers();
		}
	});
});

describe("frames and closes at the edges", () => {
	it("drops a frame whose JSON is not an object", () => {
		// A backend answering a bare list or a number is answering something that is
		// not a message, and handing it on would put `undefined` where a payload
		// should be.
		const transport = openTransport();
		const heard = vi.fn();
		transport.on("gap.updated", heard);

		lastSocket().deliver([1, 2, 3]);

		expect(heard).not.toHaveBeenCalled();
	});

	it("closes nothing twice when the link was already given up", () => {
		// `disconnect` is idempotent from the application's side, and a screen that
		// calls it in a cleanup that runs twice must not reach a socket that is gone.
		const transport = openTransport();

		transport.disconnect();

		expect(() => transport.disconnect()).not.toThrow();
		expect(transport.isOpen()).toBe(false);
	});

	it("reports one loss when the socket errors and then closes", () => {
		// A browser fires both on one dropped connection, and two losses spend two
		// rungs of the backoff for one failure.
		const transport = openTransport();
		const socket = lastSocket();

		socket.onerror?.();
		socket.onclose?.();

		expect(FakeSocket.instances).toHaveLength(1);
		transport.disconnect();
	});
});
