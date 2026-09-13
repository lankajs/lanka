import { beforeEach, describe, expect, it, vi } from "vitest";
import { lankaLogger } from "../../../logger/lanka-logger/LankaLogger";
import { LankaEventBusInstance } from "./LankaEventBusInstance";

/**
 * Bus state integrity: three silent defects.
 *
 * None of them appears as a bus problem. Two appear as "sometimes it does not
 * update", and the third as a process that died somewhere else entirely — which
 * is why they live a long time.
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

/**
 * The defect under test IS a promise handed to a parameter that expects `void`,
 * so `no-misused-promises` is suppressed at each of the two calls below.
 *
 * Not because the rule is wrong — it is the rule that would have caught this in
 * an application. It is suppressed because a consuming application is not
 * obliged to run it, and TypeScript alone permits the code, which is exactly why
 * the bus has to survive it rather than assume nobody writes it.
 */
describe("bus: a handler that is async", () => {
	let bus: LankaEventBusInstance;

	beforeEach(() => {
		bus = new LankaEventBusInstance();
	});

	it("does not let a rejected handler escape as an unhandled rejection", async () => {
		const log = vi.spyOn(lankaLogger, "printScenarioLog").mockImplementation(() => undefined);
		// `subscribe` takes `(data) => void`, and TypeScript assigns a
		// `Promise<void>` to a void return position — so an async handler compiles
		// with nothing to warn about. "Refetch when the stream reconnects" is what
		// one looks like, and it is the common case rather than an exotic one.
		const handler = async (): Promise<void> => {
			await Promise.resolve();
			throw new Error("the refetch failed");
		};

		// eslint-disable-next-line @typescript-eslint/no-misused-promises -- see above
		bus.subscribe("E", handler);
		bus.dispatch("E");

		// The rejection settles a microtask after `dispatch` has returned, which is
		// exactly why the synchronous try/catch around the call cannot see it. On
		// node's default that ends the process, and it ends it in whatever code ran
		// next rather than here.
		await Promise.resolve();
		await Promise.resolve();

		expect(log).toHaveBeenCalled();
	});

	it("still delivers to the next subscriber after one rejects", () => {
		vi.spyOn(lankaLogger, "printScenarioLog").mockImplementation(() => undefined);
		const second = vi.fn();

		// eslint-disable-next-line @typescript-eslint/no-misused-promises -- see above
		bus.subscribe("E", () => Promise.reject(new Error("no")));
		bus.subscribe("E", second);
		bus.dispatch("E");

		// The same promise the bus already makes for a synchronous throw: one
		// subscriber cannot take the dispatch down with it.
		expect(second).toHaveBeenCalledTimes(1);
	});
});
