/**
 * Registering events, subscribing to them, and the middleware chain.
 *
 * Replay, validation, logging, teardown and the stress checks:
 * `lankaEventBus.replayAndLifecycle.test.ts`.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { lankaEventBus } from "./lankaEventBus";
import {} from "../../../../logger/lanka-logger/LankaLogger";

describe("lankaEventBus — registration, subscription, middleware", () => {
	beforeEach(() => {
		lankaEventBus.reset();
		vi.restoreAllMocks();
	});

	describe("event registration & metadata", () => {
		it("auto-registers event on subscribe", () => {
			lankaEventBus.subscribe("test:event", vi.fn());

			const info = lankaEventBus.getEventInfo("test:event");
			expect(info).not.toBeNull();
			expect(info?.description).toContain("Auto-registered event");
		});

		it("explicitly registers event with metadata", () => {
			lankaEventBus.registerEvent("my:event", {
				dataType: "number",
				description: "My test event",
				usedBy: ["UnitTest"],
				priority: 5,
				maxLogs: 10,
			});

			const info = lankaEventBus.getEventInfo("my:event");
			expect(info).toEqual(
				expect.objectContaining({
					dataType: "number",
					description: "My test event",
					priority: 5,
					maxLogs: 10,
				}),
			);
		});

		it("returns sorted registered events list", () => {
			lankaEventBus.subscribe("b:event", vi.fn());
			lankaEventBus.subscribe("a:event", vi.fn());

			const events = lankaEventBus.getRegisteredEvents();
			expect(events.map((e) => e.eventType)).toEqual(["a:event", "b:event"]);
		});
	});

	describe("subscriptions", () => {
		it("calls subscriber on dispatch", () => {
			const cb = vi.fn();

			lankaEventBus.subscribe("ping", cb);
			lankaEventBus.dispatch("ping", 123);

			expect(cb).toHaveBeenCalledOnce();
			expect(cb).toHaveBeenCalledWith(123);
		});

		it("respects subscription priority", () => {
			const order: number[] = [];

			lankaEventBus.subscribe("prio", () => order.push(1), { priority: 1 });
			lankaEventBus.subscribe("prio", () => order.push(10), { priority: 10 });
			lankaEventBus.subscribe("prio", () => order.push(5), { priority: 5 });

			lankaEventBus.dispatch("prio");

			expect(order).toEqual([10, 5, 1]);
		});

		it("can unsubscribe a callback", () => {
			const cb = vi.fn();

			lankaEventBus.subscribe("off", cb);
			lankaEventBus.unsubscribe("off", cb);
			lankaEventBus.dispatch("off");

			expect(cb).not.toHaveBeenCalled();
		});

		it("survives a subscriber unsubscribing itself mid-dispatch", () => {
			const seen: string[] = [];

			const first = () => {
				seen.push("first");
				lankaEventBus.unsubscribe("reentrant", first);
			};

			lankaEventBus.subscribe("reentrant", first);
			lankaEventBus.subscribe("reentrant", () => seen.push("second"));

			lankaEventBus.dispatch("reentrant");
			lankaEventBus.dispatch("reentrant");

			// The invariant an optimisation reaches for first: iterating the live
			// array instead of a copy skips the SECOND subscriber the moment the
			// first removes itself, and the bug shows up in a screen that unsubscribed
			// on its own event — a modal closing itself, a one-shot handler.
			expect(seen).toEqual(["first", "second", "second"]);
		});
		it("tracks subscription count", () => {
			const cb1 = vi.fn();
			const cb2 = vi.fn();

			lankaEventBus.subscribe("count", cb1);
			lankaEventBus.subscribe("count", cb2);

			expect(lankaEventBus.getSubscriptions("count")).toBe(2);
		});
	});

	describe("middlewares", () => {
		it("executes middleware before subscribers", () => {
			const order: string[] = [];

			// A middleware RETURNS its decision. Nothing is dropped by omission.
			const mw = vi.fn(() => {
				order.push("mw");
				return "pass" as const;
			});

			lankaEventBus.addMiddleware(mw);

			lankaEventBus.subscribe("mw:event", () => {
				order.push("sub");
			});

			lankaEventBus.dispatch("mw:event");

			expect(order).toEqual(["mw", "sub"]);
		});

		it("can remove middleware", () => {
			const mw = vi.fn(() => "pass" as const);

			lankaEventBus.addMiddleware(mw);
			lankaEventBus.removeMiddleware(mw);

			lankaEventBus.subscribe("mw:off", vi.fn());
			lankaEventBus.dispatch("mw:off");

			expect(mw).not.toHaveBeenCalled();
		});
	});
});
