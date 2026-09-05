import { beforeEach, describe, expect, it, vi } from "vitest";
import { LankaEventBusInstance } from "./LankaEventBusInstance";
import { lankaLogger } from "../../../logger/lanka-logger/LankaLogger";

/**
 * The bus reports what became of a dispatch.
 *
 * ## What this fixes
 *
 * A middleware sees only what happened BEFORE it in the chain. A diagnostic tool
 * is installed at bootstrap, so its middleware is the first one, and it could
 * never learn that a later middleware stopped an event — `@lankajs/plugin-devtools`
 * carried a `stoppedBy` field that no code path filled, and its guide documented
 * it as working.
 *
 * An observer runs once, after the chain, and cannot decide anything. Both halves
 * are asserted below: that it is TOLD, and that being told changes nothing.
 */
describe("bus observers", () => {
	let bus: LankaEventBusInstance;

	beforeEach(() => {
		bus = new LankaEventBusInstance();
	});

	it("reports a delivered event with its audience", () => {
		const seen = vi.fn();
		bus.subscribe("E", vi.fn());
		bus.subscribe("E", vi.fn());
		bus.addObserver(seen);

		bus.dispatch("E", { id: 1 });

		expect(seen).toHaveBeenCalledWith({
			eventType: "E",
			outcome: "delivered",
			subscribers: 2,
		});
	});

	it("names the middleware that stopped an event", () => {
		// The defect this whole mechanism exists for. The observer is registered
		// FIRST and the stopping middleware second, which is the order a bootstrap
		// produces and the order in which a middleware could never see it.
		const seen = vi.fn();
		bus.addObserver(seen);
		bus.addMiddleware(() => "pass");
		bus.addMiddleware(() => ({ stop: "not permitted" }));
		bus.subscribe("E", vi.fn());

		bus.dispatch("E", { id: 1 });

		expect(seen).toHaveBeenCalledWith({
			eventType: "E",
			outcome: "stopped",
			subscribers: 1,
			stoppedBy: "not permitted",
		});
	});

	it("counts the audience that never heard a stopped event", () => {
		// Not zero. "Three subscribers never heard it" is the sentence a stopped
		// event needs, and a count reset on a stop could not say it.
		const seen = vi.fn<(outcome: { subscribers: number }) => void>();
		bus.subscribe("E", vi.fn());
		bus.subscribe("E", vi.fn());
		bus.subscribe("E", vi.fn());
		bus.addObserver(seen);
		bus.addMiddleware(() => ({ stop: "no" }));

		bus.dispatch("E");

		expect(seen.mock.calls[0][0].subscribers).toBe(3);
	});

	it("reports a payload the event's own schema refused", () => {
		vi.spyOn(lankaLogger, "printScenarioLog").mockImplementation(() => undefined);
		const seen = vi.fn();
		bus.registerEvent("E", { dataType: "number", schema: (v) => typeof v === "number" });
		bus.addObserver(seen);

		bus.dispatch("E", "not a number");

		expect(seen).toHaveBeenCalledWith({ eventType: "E", outcome: "invalid", subscribers: 0 });
	});

	it("observes without deciding: delivery happens either way", () => {
		// An observer able to stop an event would turn a diagnostic tool into a
		// participant, and "I disabled the inspector and it started working" would
		// become a sentence somebody says.
		const listener = vi.fn();
		bus.subscribe("E", listener);
		bus.addObserver(() => "stop" as unknown as void);

		bus.dispatch("E", { id: 1 });

		expect(listener).toHaveBeenCalledTimes(1);
	});

	it("survives an observer that throws, and still runs the next one", () => {
		const log = vi.spyOn(lankaLogger, "printScenarioLog").mockImplementation(() => undefined);
		const second = vi.fn();
		const listener = vi.fn();
		bus.subscribe("E", listener);
		bus.addObserver(() => {
			throw new Error("inspector is broken");
		});
		bus.addObserver(second);

		bus.dispatch("E");

		expect(listener).toHaveBeenCalledTimes(1);
		expect(second).toHaveBeenCalledTimes(1);
		expect(log).toHaveBeenCalled();
	});

	it("stops reporting to a removed observer", () => {
		const seen = vi.fn();
		bus.addObserver(seen);

		bus.dispatch("E");
		bus.removeObserver(seen);
		bus.dispatch("E");

		expect(seen).toHaveBeenCalledTimes(1);
	});

	it("keeps reporting to an observer that removes itself mid-dispatch", () => {
		// The list is iterated as a COPY, for the reason subscribers are: an
		// observer that unregisters inside its own call splices the array being
		// walked, and the neighbour after it is skipped silently.
		const second = vi.fn();
		const first = vi.fn(() => {
			bus.removeObserver(first);
		});
		bus.addObserver(first);
		bus.addObserver(second);

		bus.dispatch("E");

		expect(second).toHaveBeenCalledTimes(1);
	});

	it("drops every observer on reset", () => {
		const seen = vi.fn();
		bus.addObserver(seen);

		bus.reset();
		bus.dispatch("E");

		expect(seen).not.toHaveBeenCalled();
	});
});
