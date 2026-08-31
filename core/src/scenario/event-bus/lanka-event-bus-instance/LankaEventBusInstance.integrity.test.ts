import { beforeEach, describe, expect, it, vi } from "vitest";
import { LankaEventBusInstance } from "./LankaEventBusInstance";

/**
 * Bus state integrity: two silent defects.
 *
 * Neither appears as an error but as "sometimes it does not update" — that is,
 * as anything except a bus problem. Which is why they live a long time.
 */

describe("bus: unsubscribing inside a handler", () => {
	let bus: LankaEventBusInstance;

	beforeEach(() => {
		bus = new LankaEventBusInstance();
	});

	it("does not make the next subscriber be skipped", () => {
		const first = vi.fn();
		const second = vi.fn(() => {
			// "Waited for the session, then unsubscribed" is a routine pattern.
			bus.unsubscribe("E", second);
		});
		const third = vi.fn();

		bus.subscribe("E", first);
		bus.subscribe("E", second);
		bus.subscribe("E", third);

		bus.dispatch("E", { id: 1 });

		expect(first).toHaveBeenCalledTimes(1);
		expect(second).toHaveBeenCalledTimes(1);
		// Without the fix the third one is never called: `unsubscribe` splices the
		// array the `for` is walking, and the walk skips a neighbour. Silently.
		expect(third).toHaveBeenCalledTimes(1);
	});

	it("an unsubscriber does not receive the NEXT event", () => {
		const stopper = vi.fn(() => bus.unsubscribe("E", stopper));
		bus.subscribe("E", stopper);

		bus.dispatch("E");
		bus.dispatch("E");

		expect(stopper).toHaveBeenCalledTimes(1);
	});

	it("subscribing inside a handler does not receive the current event", () => {
		// Iterating a copy also means this: subscribing during delivery waits for
		// the next event. Otherwise delivery order would depend on subscription
		// timing, which is undefined.
		const late = vi.fn();
		const early = vi.fn(() => bus.subscribe("E", late));
		bus.subscribe("E", early);

		bus.dispatch("E");

		expect(late).not.toHaveBeenCalled();

		bus.dispatch("E");
		expect(late).toHaveBeenCalledTimes(1);
	});
});

describe("bus: registering an event again", () => {
	let bus: LankaEventBusInstance;

	beforeEach(() => {
		bus = new LankaEventBusInstance();
	});

	it("does not erase existing subscribers", () => {
		const listener = vi.fn();
		bus.subscribe("E", listener);

		bus.registerEvent("E", { dataType: "TData", description: "late registration" });
		bus.dispatch("E", { id: 1 });

		// Recreating the event's state, `subs: []` included, is saved only by
		// bootstrap order — a coincidence, not an invariant.
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it("merges metadata instead of silently replacing it", () => {
		bus.registerEvent("E", { dataType: "TData", description: "first", usedBy: ["A"] });
		bus.registerEvent("E", { dataType: "TData", description: "second", usedBy: ["B"] });

		const meta = bus.getEventInfo("E");

		expect(meta?.description).toBe("second");
		// `usedBy` lists everyone using the event. Replacing it would erase half the
		// list, which exists precisely to be complete.
		expect(meta?.usedBy).toEqual(["A", "B"]);
	});
});
