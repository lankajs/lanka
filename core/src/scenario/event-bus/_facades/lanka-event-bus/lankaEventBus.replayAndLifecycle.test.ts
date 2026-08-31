/**
 * Replay of past events to a late subscriber, schema validation, the event log,
 * teardown, and the stress checks that keep subscription bookkeeping honest under
 * volume.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { lankaEventBus } from "./lankaEventBus";
import { lankaLogger } from "../../../../logger/lanka-logger/LankaLogger";

describe("lankaEventBus — replay, validation and lifecycle", () => {
	beforeEach(() => {
		lankaEventBus.reset();
		vi.restoreAllMocks();
	});

	describe("replay functionality", () => {
		it("replays buffered events to late subscribers", async () => {
			// The event declares that it keeps the last two. Without a declaration
			// there is nothing to keep and nobody to keep it for: the buffer is
			// opt-in, where buffering EVERY event silently keeps up to a hundred per
			// type until the session ends.
			lankaEventBus.registerEvent("replay:event", { dataType: "number", replay: 2 });
			lankaEventBus.dispatch("replay:event", 1);
			lankaEventBus.dispatch("replay:event", 2);

			const cb = vi.fn();
			// `2`, not `true`: `true` means "the last one". Meaning "the whole buffer"
			// is almost never what "give me the current state" intends.
			lankaEventBus.subscribe("replay:event", cb, {
				replay: 2,
			});

			await new Promise((r) => setTimeout(r, 0));

			expect(cb).toHaveBeenCalledTimes(2);
			expect(cb).toHaveBeenNthCalledWith(1, 1);
			expect(cb).toHaveBeenNthCalledWith(2, 2);
		});

		it("does not replay more than once per subscription", async () => {
			lankaEventBus.registerEvent("once", { dataType: "string", replay: 2 });
			const cb = vi.fn();

			lankaEventBus.dispatch("once", "a");
			lankaEventBus.subscribe("once", cb, {
				replay: true,
			});

			await new Promise((r) => setTimeout(r, 0));
			await new Promise((r) => setTimeout(r, 0));

			expect(cb).toHaveBeenCalledTimes(1);
		});
	});

	describe("schema validation", () => {
		it("rejects invalid data by schema", () => {
			const spy = vi.spyOn(lankaLogger, "printScenarioLog").mockImplementation(() => {});

			lankaEventBus.registerEvent("schema:event", {
				dataType: "number",
				schema: (v) => typeof v === "number",
			});

			const cb = vi.fn();
			lankaEventBus.subscribe("schema:event", cb);

			lankaEventBus.dispatch("schema:event", "bad" as unknown as number);

			expect(cb).not.toHaveBeenCalled();
			expect(spy).toHaveBeenCalled();
		});
	});

	describe("event logs", () => {
		it("does not log events by default", () => {
			lankaEventBus.dispatch("log:event", 1);
			expect(lankaEventBus.getEventLogs("log:event")).toHaveLength(0);
		});

		it("logs events when enabled", () => {
			lankaEventBus.enableLogs();

			lankaEventBus.dispatch("log:on", 42);

			const logs = lankaEventBus.getEventLogs("log:on");
			expect(logs).toHaveLength(1);
			expect(logs[0].data).toBe(42);
			expect(logs[0].eventType).toBe("log:on");
		});

		it("respects maxLogs limit", () => {
			lankaEventBus.enableLogs();
			lankaEventBus.registerEvent("cap", { maxLogs: 2 });

			lankaEventBus.dispatch("cap", 1);
			lankaEventBus.dispatch("cap", 2);
			lankaEventBus.dispatch("cap", 3);

			const logs = lankaEventBus.getEventLogs("cap");
			expect(logs.map((l) => l.data)).toEqual([2, 3]);
		});
	});

	describe("cleanup & reset", () => {
		it("clears single event", () => {
			lankaEventBus.subscribe("clear:one", vi.fn());
			lankaEventBus.clearEvent("clear:one");

			expect(lankaEventBus.getEventInfo("clear:one")).toBeNull();
		});

		it("clears all events", () => {
			lankaEventBus.subscribe("a", vi.fn());
			lankaEventBus.subscribe("b", vi.fn());

			lankaEventBus.clearAllEvents();

			expect(lankaEventBus.getRegisteredEvents()).toHaveLength(0);
		});

		it("reset clears everything including middlewares", () => {
			const mw = vi.fn(() => "pass" as const);

			lankaEventBus.addMiddleware(mw);
			lankaEventBus.subscribe("reset", vi.fn());

			lankaEventBus.reset();
			lankaEventBus.dispatch("reset");

			expect(mw).not.toHaveBeenCalled();
		});
	});

	describe("stress: stability & performance", () => {
		it("stress: handles many subscribers", () => {
			const cb = vi.fn();

			for (let i = 0; i < 1_000; i += 1) {
				lankaEventBus.subscribe("stress:subs", cb);
			}

			lankaEventBus.dispatch("stress:subs", 1);

			expect(cb).toHaveBeenCalledTimes(1_000);
		});

		it("stress: dispatch performance", () => {
			const cb = vi.fn();
			lankaEventBus.subscribe("stress:perf", cb);

			const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

			const start = now();
			for (let i = 0; i < 10_000; i += 1) {
				lankaEventBus.dispatch("stress:perf", i);
			}
			const duration = now() - start;

			console.info(`lankaEventBus stress dispatch: ${duration.toFixed(2)}ms`);

			// A catastrophe threshold rather than a precise one: in a shared run a
			// wall clock measures machine load as much as it measures the bus. It
			// catches an order-of-magnitude difference — an accidental quadratic
			// walk — and does not fire because of a neighbour on another core.
			expect(duration).toBeLessThan(5_000);
		});
	});
});
