import { afterEach, describe, expect, it, vi } from "vitest";
import { createLankaPolling, LankaPolling } from "../src/index";
import { createPlaygroundRoom, createPlaygroundServer } from "./app";
import { safeFireAndForget } from "../src/index";

/**
 * The package, used as a realtime screen uses it.
 *
 * The unit tests prove each primitive. These prove they compose: a burst of
 * events must not write a stale list, must not send one request per event, and
 * must keep working when the poller is running underneath.
 */
afterEach(() => {
	vi.useRealTimers();
});

const participants = () => [
	{ id: 1, name: "Ada" },
	{ id: 2, name: "Grace" },
];

describe("the async playground", () => {
	it("writes the answer to a single refresh", async () => {
		const server = createPlaygroundServer(participants());
		const room = createPlaygroundRoom(server);

		await room.refresh();

		expect(room.participants).toHaveLength(2);
		expect(room.writes).toBe(1);
	});

	it("writes only the LAST answer when a slow one lands after a fast one", async () => {
		// The failure this prevents: a burst of events, answers arriving out of
		// order, and the screen settling on the oldest of them.
		const server = createPlaygroundServer(participants());
		const room = createPlaygroundRoom(server);

		server.delayMs = 20;
		const slow = room.refresh();

		server.delayMs = 0;
		server.participants = [{ id: 3, name: "Barbara" }];
		await room.refresh();
		await slow;

		expect(room.participants).toEqual([{ id: 3, name: "Barbara" }]);
		expect(room.writes).toBe(1);
	});

	it("sends a request per refresh when nothing coalesces them", async () => {
		const server = createPlaygroundServer(participants());
		const room = createPlaygroundRoom(server);

		await Promise.all([room.refresh(), room.refresh(), room.refresh()]);

		expect(server.calls).toHaveLength(3);
	});

	it("coalesces a burst on one key into far fewer requests", async () => {
		// One user action seen by ten participants must not become ten requests.
		const server = createPlaygroundServer(participants());
		const room = createPlaygroundRoom(server);
		server.delayMs = 5;

		await Promise.all(Array.from({ length: 10 }, () => room.refreshCoalesced("participants")));

		expect(server.calls.length).toBeLessThan(10);
		expect(room.participants).toHaveLength(2);
	});

	it("still answers every caller of a coalesced burst", async () => {
		// Fewer requests must not mean fewer resolutions: a caller whose promise
		// never settles is a spinner that never stops.
		const server = createPlaygroundServer(participants());
		const room = createPlaygroundRoom(server);
		server.delayMs = 5;

		const settled = await Promise.all(
			Array.from({ length: 5 }, () =>
				room.refreshCoalesced("participants").then(() => "done"),
			),
		);

		expect(settled).toEqual(["done", "done", "done", "done", "done"]);
	});

	it("keeps fetching while the poller runs, and stops when it is cleared", async () => {
		vi.useFakeTimers();
		const server = createPlaygroundServer(participants());
		const room = createPlaygroundRoom(server);

		room.startPolling(100);
		await vi.advanceTimersByTimeAsync(350);
		const whilePolling = server.calls.length;

		room.stopPolling();
		await vi.advanceTimersByTimeAsync(500);

		expect(whilePolling).toBeGreaterThan(0);
		expect(server.calls.length).toBe(whilePolling);
	});
});

describe("a promise nobody waits for", () => {
	it("swallows a rejection instead of becoming an unhandled one", async () => {
		// The case: a refresh fired from a click handler. Nobody awaits it, and an
		// unhandled rejection inside a WebView is a crash report with no cause in it.
		safeFireAndForget(Promise.reject(new Error("the wire was busy")));

		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(true).toBe(true);
	});
});

describe("either style builds the same polling", () => {
	it("subscribes and clears through both", () => {
		const built = createLankaPolling();
		const constructed = new LankaPolling();

		const first = built.subscribe(() => Promise.resolve(), 1000);
		const second = constructed.subscribe(() => Promise.resolve(), 1000);

		// Two doors, one class: an id from each, and neither knows about the other.
		expect(typeof first).toBe("string");
		expect(typeof second).toBe("string");
		expect(first).not.toBe(second);

		built.clearAll();
		constructed.clearAll();
	});
});
