import { beforeEach, describe, expect, it, vi } from "vitest";
import { LankaEventBusInstance } from "./LankaEventBusInstance";

/**
 * Bus middleware reports a decision instead of staying silent.
 *
 * ## What this fixes
 *
 * A chain resting on every middleware calling `next()` means that not calling
 * it runs no subscriber and produces neither a log line nor a counter: a
 * mechanism that exists for observability becomes its own blind spot, and the
 * event simply vanishes.
 *
 * Middleware returns `"pass"` or `{ stop: reason }`, and a stop is written to
 * the bus log — visible to the same `@lankajs/plugin-devtools` the mechanism
 * exists for.
 */

describe("bus middleware", () => {
	let bus: LankaEventBusInstance;

	beforeEach(() => {
		bus = new LankaEventBusInstance();
		bus.enableLogs();
	});

	it("`pass` lets the event through", () => {
		const listener = vi.fn();
		bus.subscribe("E", listener);
		bus.addMiddleware(() => "pass");

		bus.dispatch("E", { id: 1 });

		expect(listener).toHaveBeenCalledTimes(1);
	});

	it("`stop` halts delivery", () => {
		const listener = vi.fn();
		bus.subscribe("E", listener);
		bus.addMiddleware(() => ({ stop: "not permitted" }));

		bus.dispatch("E", { id: 1 });

		expect(listener).not.toHaveBeenCalled();
	});

	it("a stop is logged with its reason — otherwise it would be invisible", () => {
		bus.subscribe("E", vi.fn());
		bus.addMiddleware(() => ({ stop: "not permitted" }));

		bus.dispatch("E", { id: 1 });

		const logs = bus.getEventLogs("E");
		expect(logs.at(-1)?.stoppedBy).toBe("not permitted");
	});

	it("the stopper is named: with several middleware you can tell which one", () => {
		bus.subscribe("E", vi.fn());
		bus.addMiddleware(() => "pass");
		bus.addMiddleware(() => ({ stop: "the second one decided" }));

		bus.dispatch("E");

		expect(bus.getEventLogs("E").at(-1)?.stoppedBy).toBe("the second one decided");
	});

	it("a stop does not affect the next event", () => {
		const listener = vi.fn();
		bus.subscribe("E", listener);
		let allow = false;
		bus.addMiddleware(() => (allow ? "pass" : { stop: "not yet" }));

		bus.dispatch("E");
		allow = true;
		bus.dispatch("E");

		expect(listener).toHaveBeenCalledTimes(1);
	});

	it("a throwing middleware does not take delivery down silently", () => {
		// An exception is also a way not to call `next`. Surfacing out of `dispatch`
		// it would break whoever dispatched the event; instead it stops delivery and
		// names itself in the log.
		const listener = vi.fn();
		bus.subscribe("E", listener);
		bus.addMiddleware(() => {
			throw new Error("the plugin broke");
		});

		expect(() => bus.dispatch("E")).not.toThrow();
		expect(listener).not.toHaveBeenCalled();
		expect(bus.getEventLogs("E").at(-1)?.stoppedBy).toContain("the plugin broke");
	});
});

/**
 * A STOPPED event is not replayed either.
 *
 * `TLankaEventBusDecision` says `{ stop }` "halts it", and middleware is what an
 * application gates an event with — an authorisation check, a privacy filter, a
 * feature flag. The buffer was filled BEFORE the chain ran, so a halted payload
 * still sat in it: the next subscriber asking for replay received an event that
 * no subscriber was allowed to see, and nothing in the bus log recorded that
 * delivery. A gate the framework routes around is not a gate.
 *
 * Fake timers because replay is batched into a tick.
 */
describe("bus middleware: a stopped event and the replay buffer", () => {
	let bus: LankaEventBusInstance;

	beforeEach(() => {
		vi.useFakeTimers();
		bus = new LankaEventBusInstance();
		bus.enableLogs();
	});

	it("does not buffer an event the chain stopped", () => {
		bus.subscribe("E", vi.fn(), { replay: "last" });
		bus.addMiddleware(() => ({ stop: "not permitted" }));

		bus.dispatch("E", { secret: true });

		expect(bus.getBufferedCount("E")).toBe(0);
	});

	it("does not replay a stopped event to a late subscriber", () => {
		bus.subscribe("E", vi.fn(), { replay: "last" });
		bus.addMiddleware(() => ({ stop: "not permitted" }));
		bus.dispatch("E", { secret: true });

		const late = vi.fn();
		bus.subscribe("E", late, { replay: "last" });
		vi.runAllTimers();

		expect(late).not.toHaveBeenCalled();
	});

	it("still buffers and replays an event the chain passed", () => {
		bus.subscribe("E", vi.fn(), { replay: "last" });
		const gate = vi.fn(() => "pass" as const);
		bus.addMiddleware(gate);
		bus.dispatch("E", { ok: true });

		const late = vi.fn();
		bus.subscribe("E", late, { replay: "last" });
		vi.runAllTimers();

		// The guard against over-correcting: a passing gate must change nothing.
		expect(late).toHaveBeenCalledWith({ ok: true });
	});
});
