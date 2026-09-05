import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLanka } from "lanka";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { LankaSseTransport } from "./LankaSseTransport";

/**
 * The server event transport.
 *
 * What is pinned is not "does SSE work" — jsdom has none — but the three things
 * lost first in any port: the URL comes from the host, a missing engine breaks
 * nothing, and reconnection does not turn into a storm.
 */

/** A fake `EventSource`: full control over connection events. */
class FakeEventSource {
	public static instances: FakeEventSource[] = [];
	public static failConstruction = false;

	public onopen: (() => void) | null = null;
	public onerror: (() => void) | null = null;
	public onmessage: ((event: MessageEvent) => void) | null = null;
	public closed = false;
	public readonly typed = new Map<string, (event: MessageEvent) => void>();

	public readonly url: string;
	public readonly init?: { withCredentials?: boolean };

	public constructor(url: string, init?: { withCredentials?: boolean }) {
		this.url = url;
		this.init = init;
		if (FakeEventSource.failConstruction) throw new Error("connection refused");
		FakeEventSource.instances.push(this);
	}

	public addEventListener(type: string, handler: (event: MessageEvent) => void): void {
		this.typed.set(type, handler);
	}

	public close(): void {
		this.closed = true;
	}

	public emit(type: string, data: unknown): void {
		const payload = { data: JSON.stringify(data) } as MessageEvent;
		if (type === "message") this.onmessage?.(payload);
		else this.typed.get(type)?.(payload);
	}
}

const installFakeEventSource = (): void => {
	FakeEventSource.instances = [];
	FakeEventSource.failConstruction = false;
	vi.stubGlobal("EventSource", FakeEventSource);
};

const lastSource = (): FakeEventSource => {
	const source = FakeEventSource.instances.at(-1);
	if (!source) throw new Error("no connection was opened");
	return source;
};

beforeEach(() => {
	createLanka({ host: { ...lankaTestHost, apiBaseUrl: "https://api.test/v1/" } });
	installFakeEventSource();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("LankaSseTransport — the URL", () => {
	it("comes from the host, not from the bundler", async () => {
		// Reading `import.meta.env.VITE_API_URL` would mean knowing the name of a
		// variable in the consumer's environment. A package reading someone else's
		// build global works for exactly one consumer and throws on import in node.
		const transport = new LankaSseTransport();

		transport.connect();

		expect(lastSource().url).toBe("https://api.test/v1/sse/events");
		await Promise.resolve();
	});

	it("the stream path is configurable", () => {
		new LankaSseTransport({ path: "events/stream" }).connect();

		expect(lastSource().url).toBe("https://api.test/v1/events/stream");
	});

	it("cookies are sent by default", () => {
		new LankaSseTransport().connect();

		expect(lastSource().init?.withCredentials).toBe(true);
	});
});

describe("LankaSseTransport — an engine without server events", () => {
	it("does not throw and reports being unsupported", () => {
		// Realtime is then simply off for the session: screens keep working and data
		// arrives through route loaders. Throwing here would be a regression
		// against code that degraded.
		vi.stubGlobal("EventSource", undefined);
		const transport = new LankaSseTransport();

		expect(transport.isSupported()).toBe(false);
		expect(() => {
			transport.connect();
		}).not.toThrow();
	});

	it("a subscription without a connection is neither lost nor fatal", () => {
		vi.stubGlobal("EventSource", undefined);
		const transport = new LankaSseTransport();
		const handler = vi.fn();

		const off = transport.on("gap.updated", handler);
		transport.connect();

		expect(handler).not.toHaveBeenCalled();
		expect(() => {
			off();
		}).not.toThrow();
	});

	it("an engine that exposes the constructor but refuses the connection does not loop", () => {
		// Strict CSP, a proxy, a forbidden scheme. Retrying a construction that
		// cannot succeed is a storm with no possibility of success.
		FakeEventSource.failConstruction = true;
		const transport = new LankaSseTransport();

		expect(() => {
			transport.connect();
		}).not.toThrow();
		expect(FakeEventSource.instances).toHaveLength(0);
	});
});

describe("LankaSseTransport — events", () => {
	it("unwraps the `{ trigger, payload }` envelope", () => {
		const transport = new LankaSseTransport();
		const handler = vi.fn();
		transport.on("gap.updated", handler);
		transport.connect();

		lastSource().emit("gap.updated", { trigger: "gap.updated", payload: { id: 7 } });

		expect(handler).toHaveBeenCalledWith({ id: 7 });
	});

	it("accepts a bare body too", () => {
		// Refusing the second form would silently lose events for a backend that
		// still sends it.
		const transport = new LankaSseTransport();
		const handler = vi.fn();
		transport.on("gap.updated", handler);
		transport.connect();

		lastSource().emit("gap.updated", { id: 7 });

		expect(handler).toHaveBeenCalledWith({ id: 7 });
	});

	it("an unreadable body is skipped silently instead of breaking the stream", () => {
		const transport = new LankaSseTransport();
		const handler = vi.fn();
		transport.on("gap.updated", handler);
		transport.connect();

		const source = lastSource();
		source.typed.get("gap.updated")?.({ data: "not json" } as MessageEvent);

		expect(handler).not.toHaveBeenCalled();
	});

	it("a shared `message` stream is dispatched by its `type` field", () => {
		const transport = new LankaSseTransport();
		const handler = vi.fn();
		transport.on("gap.updated", handler);
		transport.connect();

		lastSource().emit("message", { type: "gap.updated", id: 7 });

		expect(handler).toHaveBeenCalledWith({ type: "gap.updated", id: 7 });
	});

	it("unsubscribing inside a handler does not skip a neighbour", () => {
		// Iterating a live set while removing from it skips the next element —
		// quietly, and only sometimes.
		const transport = new LankaSseTransport();
		const second = vi.fn();
		let off: (() => void) | null = null;
		off = transport.on("gap.updated", () => off?.());
		transport.on("gap.updated", second);
		transport.connect();

		lastSource().emit("gap.updated", { id: 1 });

		expect(second).toHaveBeenCalledTimes(1);
	});
});

describe("LankaSseTransport — reconnection", () => {
	it("backs off and does not exceed the attempt ceiling", async () => {
		vi.useFakeTimers();
		try {
			const transport = new LankaSseTransport({ maxReconnectAttempts: 3 });
			transport.connect();

			for (let round = 0; round < 10; round += 1) {
				lastSource().onerror?.();
				await vi.advanceTimersByTimeAsync(60_000);
			}

			// Three attempts plus the original connection and not one more: a server
			// dropping the connection immediately would otherwise get a steady
			// stream.
			expect(FakeEventSource.instances).toHaveLength(4);
		} finally {
			vi.useRealTimers();
		}
	});

	it("after reconnecting it calls the catch-up hook", async () => {
		vi.useFakeTimers();
		try {
			const transport = new LankaSseTransport();
			const onReconnect = vi.fn();
			transport.onReconnect(onReconnect);
			transport.connect();
			// The stream OPENS first. Without this the case under test is a first
			// attempt that failed, which is not a reconnection and is pinned as such
			// two tests down.
			lastSource().onopen?.();

			lastSource().onerror?.();
			await vi.advanceTimersByTimeAsync(2_000);
			lastSource().onopen?.();

			expect(onReconnect).toHaveBeenCalledTimes(1);
		} finally {
			vi.useRealTimers();
		}
	});

	it("the first connection does not call catch-up", async () => {
		// Nothing to catch up on: nothing was missed.
		const transport = new LankaSseTransport();
		const onReconnect = vi.fn();
		transport.onReconnect(onReconnect);
		transport.connect();

		lastSource().onopen?.();
		await Promise.resolve();

		expect(onReconnect).not.toHaveBeenCalled();
	});

	it("nor does the first one that OPENS, when an earlier attempt was refused", async () => {
		// The stream has never delivered anything, so nothing was missed. Called a
		// reconnection, this makes every screen refetch the data it has just loaded
		// — on the ordinary start-up where one attempt is refused.
		vi.useFakeTimers();
		try {
			const transport = new LankaSseTransport();
			const onReconnect = vi.fn();
			transport.onReconnect(onReconnect);
			transport.connect();

			lastSource().onerror?.();
			await vi.advanceTimersByTimeAsync(1000);
			lastSource().onopen?.();

			expect(onReconnect).not.toHaveBeenCalled();
		} finally {
			vi.useRealTimers();
		}
	});

	it("having exhausted attempts, it tries to refresh authorization", async () => {
		vi.useFakeTimers();
		try {
			const refreshAuth = vi.fn(() => Promise.resolve(true));
			const transport = new LankaSseTransport({ maxReconnectAttempts: 1, refreshAuth });
			transport.connect();

			lastSource().onerror?.();
			await vi.advanceTimersByTimeAsync(5_000);
			lastSource().onerror?.();
			await vi.advanceTimersByTimeAsync(5_000);

			expect(refreshAuth).toHaveBeenCalledTimes(1);
		} finally {
			vi.useRealTimers();
		}
	});

	it("failing to refresh, it reports the session as lost", async () => {
		vi.useFakeTimers();
		try {
			const onSessionLost = vi.fn();
			const transport = new LankaSseTransport({
				maxReconnectAttempts: 0,
				refreshAuth: () => Promise.resolve(false),
				onSessionLost,
			});
			transport.connect();

			lastSource().onerror?.();
			await vi.advanceTimersByTimeAsync(1_000);

			expect(onSessionLost).toHaveBeenCalledTimes(1);
		} finally {
			vi.useRealTimers();
		}
	});

	it("an explicit disconnect cancels a scheduled reconnect", async () => {
		// Winding the counter to its limit instead of using a flag lets a reconnect
		// that was waiting on an auth refresh bring the connection up AFTER an
		// explicit disconnect.
		vi.useFakeTimers();
		try {
			const transport = new LankaSseTransport();
			transport.connect();

			lastSource().onerror?.();
			transport.disconnect();
			await vi.advanceTimersByTimeAsync(60_000);

			expect(FakeEventSource.instances).toHaveLength(1);
		} finally {
			vi.useRealTimers();
		}
	});

	it("disconnecting closes the connection", () => {
		const transport = new LankaSseTransport();
		transport.connect();
		const source = lastSource();

		transport.disconnect();

		expect(source.closed).toBe(true);
	});

	it("calling `connect` again opens no second connection", () => {
		const transport = new LankaSseTransport();

		transport.connect();
		transport.connect();

		expect(FakeEventSource.instances).toHaveLength(1);
	});
});

describe("what is refused", () => {
	it("drops a frame whose body is not text", () => {
		// A binary frame, or a `MessageEvent` from something that is not this
		// stream: parsing it would throw inside the connection's own callback, where
		// nothing above can catch it.
		const transport = new LankaSseTransport();
		const heard = vi.fn();
		transport.on("gap.updated", heard);
		transport.connect();

		lastSource().typed.get("gap.updated")?.({ data: 42 } as unknown as MessageEvent);

		expect(heard).not.toHaveBeenCalled();
	});

	it("stops telling a reconnect listener that unsubscribed", async () => {
		// A screen that has gone still holds a refetch, and a refetch after the
		// screen is gone is a request nobody reads and state nobody owns.
		vi.useFakeTimers();
		try {
			const transport = new LankaSseTransport();
			const caughtUp = vi.fn();
			transport.connect();
			transport.onReconnect(caughtUp)();

			lastSource().onerror?.();
			await vi.advanceTimersByTimeAsync(1000);
			lastSource().onopen?.();

			expect(caughtUp).not.toHaveBeenCalled();
		} finally {
			vi.useRealTimers();
		}
	});

	it("drops a frame whose JSON is not an object", () => {
		// A backend answering a bare list or a number is answering something that is
		// not an event, and handing it to a bridge would put `undefined` where the
		// payload should be.
		const transport = new LankaSseTransport();
		const heard = vi.fn();
		transport.on("gap.updated", heard);
		transport.connect();

		lastSource().emit("gap.updated", [1, 2, 3]);

		expect(heard).not.toHaveBeenCalled();
	});

	it("dispatches nothing for a type whose last subscriber left", () => {
		const transport = new LankaSseTransport();
		const heard = vi.fn();
		transport.connect();
		transport.on("gap.updated", heard)();

		lastSource().emit("gap.updated", { id: 7 });

		expect(heard).not.toHaveBeenCalled();
	});
});
