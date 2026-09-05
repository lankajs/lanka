import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	ALankaStreamTransport,
	type ILankaStreamConfig,
	type ILankaStreamTransportHandlers,
} from "./ALankaStreamTransport";

/**
 * A transport whose wire is a pair of methods a test calls.
 *
 * Everything under test is in the BASE: what the subclass does is open, close
 * and hand back the three handlers, which is exactly the contract a protocol
 * package writes against.
 */
class TestTransport extends ALankaStreamTransport {
	public opens = 0;
	public closes = 0;
	public supported = true;
	public throwOnOpen = false;
	public readonly subscribed: string[] = [];
	public readonly unsubscribed: string[] = [];

	private wire: ILankaStreamTransportHandlers | null = null;

	public isSupported(): boolean {
		return this.supported;
	}

	protected open(handlers: ILankaStreamTransportHandlers): void {
		this.opens += 1;
		if (this.throwOnOpen) throw new Error("this engine refuses the connection");
		this.wire = handlers;
	}

	protected close(): void {
		this.closes += 1;
	}

	protected subscribeTo(eventType: string): void {
		this.subscribed.push(eventType);
	}

	protected unsubscribeFrom(eventType: string): void {
		this.unsubscribed.push(eventType);
	}

	/** What the far end does, as a test says it. */
	public serverOpened(): void {
		this.wire?.opened();
	}

	public serverSent(eventType: string, payload: Record<string, unknown>): void {
		this.wire?.received(eventType, payload);
	}

	public serverDropped(): void {
		this.wire?.lost();
	}

	/** The types the base thinks are wanted, read from inside the class. */
	public wanted(): readonly string[] {
		return this.subscribedEventTypes();
	}
}

const openedTransport = (config: ILankaStreamConfig = {}): TestTransport => {
	const transport = new TestTransport(config);
	transport.connect();
	transport.serverOpened();
	return transport;
};

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe("connecting", () => {
	it("opens once, however many times it is asked", () => {
		// A second connection to the same stream doubles every event, and the
		// duplicate is invisible until something counts.
		const transport = openedTransport();

		transport.connect();

		expect(transport.opens).toBe(1);
	});

	it("does not open on an engine that cannot carry it", () => {
		// Absent support is not a failure: every screen keeps working because the
		// same data arrives through the ordinary request path.
		const transport = new TestTransport();
		transport.supported = false;

		transport.connect();

		expect(transport.opens).toBe(0);
	});

	it("gives up quietly when opening throws", () => {
		// A scheme a proxy will not upgrade, a strict CSP, a URL the platform
		// rejects: retrying what cannot succeed is a storm.
		const transport = new TestTransport();
		transport.throwOnOpen = true;

		transport.connect();
		vi.advanceTimersByTime(60_000);

		expect(transport.opens).toBe(1);
	});

	it("can be opened again after an explicit disconnect", () => {
		const transport = openedTransport();

		transport.disconnect();
		transport.connect();

		expect(transport.opens).toBe(2);
	});

	it("closes nothing when it was never open", () => {
		const transport = new TestTransport();

		transport.disconnect();

		expect(transport.closes).toBe(0);
	});
});

describe("subscriptions", () => {
	it("tells the wire about a type registered before the connection", () => {
		const transport = new TestTransport();
		transport.on("gap.updated", vi.fn());

		transport.connect();
		transport.serverOpened();

		expect(transport.subscribed).toEqual(["gap.updated"]);
	});

	it("tells the wire about a type registered after it", () => {
		const transport = openedTransport();

		transport.on("gap.updated", vi.fn());

		expect(transport.subscribed).toEqual(["gap.updated"]);
	});

	it("registers a type once however many callers want it", () => {
		const transport = openedTransport();

		transport.on("gap.updated", vi.fn());
		transport.on("gap.updated", vi.fn());

		expect(transport.subscribed).toEqual(["gap.updated"]);
	});

	it("takes the registration back when the last caller goes", () => {
		const transport = openedTransport();
		const stopFirst = transport.on("gap.updated", vi.fn());
		const stopSecond = transport.on("gap.updated", vi.fn());

		stopFirst();
		expect(transport.unsubscribed).toEqual([]);

		stopSecond();
		expect(transport.unsubscribed).toEqual(["gap.updated"]);
	});

	it("unsubscribing twice is not a second removal", () => {
		const transport = openedTransport();
		const stop = transport.on("gap.updated", vi.fn());

		stop();
		stop();

		expect(transport.unsubscribed).toEqual(["gap.updated"]);
	});

	it("re-registers everything wanted when the link comes back", () => {
		// A wire that needs telling — a `graphql-ws` subscription, a gRPC stream —
		// has forgotten everything, and a subclass must not have to remember for it.
		const transport = openedTransport();
		transport.on("gap.updated", vi.fn());

		transport.serverDropped();
		vi.advanceTimersByTime(1000);
		transport.serverOpened();

		expect(transport.subscribed).toEqual(["gap.updated", "gap.updated"]);
	});

	it("delivers to every subscriber of a type", () => {
		const transport = openedTransport();
		const first = vi.fn();
		const second = vi.fn();
		transport.on("gap.updated", first);
		transport.on("gap.updated", second);

		transport.serverSent("gap.updated", { id: 7 });

		expect(first).toHaveBeenCalledWith({ id: 7 });
		expect(second).toHaveBeenCalledWith({ id: 7 });
	});

	it("a subscriber unsubscribing mid-dispatch does not silence its neighbour", () => {
		// Iterating the live set splices under the loop and skips the next one,
		// which shows up as one screen out of two failing to update.
		const transport = openedTransport();
		const second = vi.fn();
		const stop = transport.on("gap.updated", () => {
			stop();
		});
		transport.on("gap.updated", second);

		transport.serverSent("gap.updated", { id: 7 });

		expect(second).toHaveBeenCalledTimes(1);
	});

	it("drops an event type nobody asked for", () => {
		const transport = openedTransport();
		const heard = vi.fn();
		transport.on("gap.updated", heard);

		transport.serverSent("something.else", { id: 7 });

		expect(heard).not.toHaveBeenCalled();
	});

	it("reports what is wanted to a subclass that needs the list", () => {
		const transport = openedTransport();
		transport.on("a", vi.fn());
		transport.on("b", vi.fn());

		expect([...transport.wanted()]).toEqual(["a", "b"]);
	});
});

describe("the reconnect ladder", () => {
	it("never announces the FIRST connection as a reconnection", () => {
		// Its meaning is "you missed something". Announced on a first connection,
		// every screen refetches data it just loaded.
		const transport = new TestTransport();
		const caughtUp = vi.fn();
		transport.onReconnect(caughtUp);

		transport.connect();
		transport.serverOpened();

		expect(caughtUp).not.toHaveBeenCalled();
	});

	it("does not announce one when the FIRST attempt failed and the second opened", () => {
		// The connection has never delivered anything, so nothing was missed. Called
		// a reconnection, this makes every screen refetch the data it has just
		// loaded — on the ordinary start-up where one attempt is refused.
		const transport = new TestTransport();
		const caughtUp = vi.fn();
		transport.onReconnect(caughtUp);

		transport.connect();
		transport.serverDropped();
		vi.advanceTimersByTime(1000);
		transport.serverOpened();

		expect(caughtUp).not.toHaveBeenCalled();
	});

	it("announces one after THAT connection is lost and comes back", () => {
		// The other half of the rule above: once a connection has opened, every
		// later one is a reconnection and there IS a gap to catch up on.
		const transport = new TestTransport();
		const caughtUp = vi.fn();
		transport.onReconnect(caughtUp);

		transport.connect();
		transport.serverDropped();
		vi.advanceTimersByTime(1000);
		transport.serverOpened();
		transport.serverDropped();
		vi.advanceTimersByTime(1000);
		transport.serverOpened();

		expect(caughtUp).toHaveBeenCalledTimes(1);
	});

	it("does not announce one when a connection reports itself open twice", () => {
		// A duplicate handshake acknowledgement is one connection, not two.
		const transport = openedTransport();
		const caughtUp = vi.fn();
		transport.onReconnect(caughtUp);

		transport.serverOpened();

		expect(caughtUp).not.toHaveBeenCalled();
	});

	it("announces every one after that", () => {
		const transport = openedTransport();
		const caughtUp = vi.fn();
		transport.onReconnect(caughtUp);

		transport.serverDropped();
		vi.advanceTimersByTime(1000);
		transport.serverOpened();

		expect(caughtUp).toHaveBeenCalledTimes(1);
	});

	it("stops announcing to a listener that unsubscribed", () => {
		const transport = openedTransport();
		const caughtUp = vi.fn();
		transport.onReconnect(caughtUp)();

		transport.serverDropped();
		vi.advanceTimersByTime(1000);
		transport.serverOpened();

		expect(caughtUp).not.toHaveBeenCalled();
	});

	it("waits longer after each failed attempt, up to the ceiling", () => {
		const transport = new TestTransport({ maxReconnectDelayMs: 4000 });
		transport.connect();
		transport.serverOpened();

		const delays = [1000, 2000, 4000, 4000];
		for (const [index, delay] of delays.entries()) {
			transport.serverDropped();
			vi.advanceTimersByTime(delay - 1);
			expect(transport.opens).toBe(index + 1);
			vi.advanceTimersByTime(1);
			expect(transport.opens).toBe(index + 2);
		}
	});

	it("counts attempts from the last connection that actually opened", () => {
		// Resetting the counter in `connect()` returns it to zero on every attempt,
		// because the timer calls `connect()`. The ceiling then exists, reads as a
		// guard, and can never fire.
		const transport = new TestTransport({ maxReconnectAttempts: 2 });
		transport.connect();
		transport.serverOpened();

		transport.serverDropped();
		vi.advanceTimersByTime(1000);
		transport.serverDropped();
		vi.advanceTimersByTime(2000);
		transport.serverDropped();
		vi.advanceTimersByTime(60_000);

		expect(transport.opens).toBe(3);
	});

	it("tries once more when the session was refreshed", async () => {
		const refreshAuth = vi.fn(() => Promise.resolve(true));
		const transport = new TestTransport({ maxReconnectAttempts: 0, refreshAuth });
		transport.connect();

		transport.serverDropped();
		await vi.runAllTimersAsync();

		expect(refreshAuth).toHaveBeenCalledTimes(1);
		expect(transport.opens).toBe(2);
	});

	it("reports the session lost when it could not be refreshed", async () => {
		const onSessionLost = vi.fn();
		const transport = new TestTransport({
			maxReconnectAttempts: 0,
			refreshAuth: () => Promise.resolve(false),
			onSessionLost,
		});
		transport.connect();

		transport.serverDropped();
		await vi.runAllTimersAsync();

		expect(onSessionLost).toHaveBeenCalledTimes(1);
		expect(transport.opens).toBe(1);
	});

	it("reports the session lost when nothing can refresh it", async () => {
		const onSessionLost = vi.fn();
		const transport = new TestTransport({ maxReconnectAttempts: 0, onSessionLost });
		transport.connect();

		transport.serverDropped();
		await vi.runAllTimersAsync();

		expect(onSessionLost).toHaveBeenCalledTimes(1);
	});

	it("an explicit disconnect outranks a scheduled attempt", () => {
		const transport = openedTransport();

		transport.serverDropped();
		transport.disconnect();
		vi.advanceTimersByTime(60_000);

		expect(transport.opens).toBe(1);
	});

	it("an explicit disconnect outranks a refresh already in flight", async () => {
		// The refresh is a network call of unknown length. An application that
		// signed the user out while it was running must not be handed a connection.
		let finishRefresh: (ok: boolean) => void = () => undefined;
		const transport = new TestTransport({
			maxReconnectAttempts: 0,
			refreshAuth: () =>
				new Promise<boolean>((resolve) => {
					finishRefresh = resolve;
				}),
		});
		transport.connect();

		transport.serverDropped();
		transport.disconnect();
		finishRefresh(true);
		await vi.runAllTimersAsync();

		expect(transport.opens).toBe(1);
	});

	it("spends one rung when a subclass reports the same loss twice", () => {
		// A browser fires `error` and then `close` on one dropped socket. Counted
		// twice, one failure eats two attempts of the ceiling — and a transport a
		// CONSUMER wrote has no flag of its own to stop that.
		const transport = openedTransport();

		transport.serverDropped();
		transport.serverDropped();
		vi.advanceTimersByTime(1000);

		expect(transport.opens).toBe(2);
		expect(transport.closes).toBe(1);
	});

	it("ignores a loss that arrives after an explicit disconnect", () => {
		// The socket reports itself closed BECAUSE the application closed it.
		// Believed, it would reconnect what was just given up.
		const transport = openedTransport();

		transport.disconnect();
		transport.serverDropped();
		vi.advanceTimersByTime(60_000);

		expect(transport.opens).toBe(1);
	});

	it("closes what the subclass opened when the far end drops it", () => {
		// `close` is called from both sides and must be idempotent: neither the base
		// nor the subclass knows what the other already did.
		const transport = openedTransport();

		transport.serverDropped();

		expect(transport.closes).toBe(1);
	});
});
