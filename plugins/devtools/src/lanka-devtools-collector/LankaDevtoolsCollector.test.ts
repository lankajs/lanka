import { describe, expect, it, vi } from "vitest";
import { LankaDevtoolsCollector } from "./LankaDevtoolsCollector";

/**
 * The bookkeeping the plugin rests on, tested without a framework.
 *
 * Two of these are the reason the collector is not simply a list: a dispatch is
 * recorded when it STARTS and completed when the bus says how it ended, and a
 * subscriber dispatching another event makes those two orders differ.
 */
const clock = () => 42;

describe("LankaDevtoolsCollector", () => {
	it("records a dispatch as pending until the bus says otherwise", () => {
		// A row stuck on `pending` means delivery never finished, which is a finding
		// rather than a gap — so the value has to exist.
		const collector = new LankaDevtoolsCollector({ clock });

		collector.recordEvent({ eventType: "cart:changed", subscribers: 2 });

		expect(collector.getSnapshot().events).toEqual([
			{ at: 42, eventType: "cart:changed", subscribers: 2, outcome: "pending" },
		]);
	});

	it("completes a dispatch with what stopped it", () => {
		const collector = new LankaDevtoolsCollector({ clock });
		collector.recordEvent({ eventType: "cart:changed", subscribers: 2 });

		collector.completeEvent({
			eventType: "cart:changed",
			outcome: "stopped",
			subscribers: 2,
			stoppedBy: "not signed in",
		});

		expect(collector.getSnapshot().events).toEqual([
			{
				at: 42,
				eventType: "cart:changed",
				subscribers: 2,
				outcome: "stopped",
				stoppedBy: "not signed in",
			},
		]);
	});

	it("matches a nested dispatch to the right row", () => {
		// A subscriber dispatching another event nests: the INNER one finishes
		// first. Completing the oldest row instead would put the inner event's
		// outcome on the outer one, and the panel would name the wrong middleware.
		const collector = new LankaDevtoolsCollector({ clock });
		collector.recordEvent({ eventType: "outer", subscribers: 1 });
		collector.recordEvent({ eventType: "inner", subscribers: 1 });

		collector.completeEvent({ eventType: "inner", outcome: "delivered", subscribers: 1 });
		collector.completeEvent({
			eventType: "outer",
			outcome: "stopped",
			subscribers: 1,
			stoppedBy: "a rule",
		});

		const [outer, inner] = collector.getSnapshot().events;
		expect(outer).toMatchObject({ eventType: "outer", stoppedBy: "a rule" });
		expect(inner).toMatchObject({ eventType: "inner", outcome: "delivered" });
	});

	it("records an outcome for a dispatch it never saw start", () => {
		// A middleware registered BEFORE the inspector's stopped the event, so the
		// inspector's own middleware never ran. That it never reached the inspector
		// is itself worth showing rather than dropping.
		const collector = new LankaDevtoolsCollector({ clock });

		collector.completeEvent({
			eventType: "cart:changed",
			outcome: "stopped",
			subscribers: 4,
			stoppedBy: "a gate ahead of the inspector",
		});

		expect(collector.getSnapshot().events).toHaveLength(1);
		expect(collector.getSnapshot().events[0].stoppedBy).toBe("a gate ahead of the inspector");
	});

	it("lists a registered scenario that has never fired", () => {
		// The case the list is opened for, and the one a list built from what
		// HAPPENED cannot show.
		const collector = new LankaDevtoolsCollector({
			clock,
			readScenarios: () => [
				{ eventType: "never:fired", subscribers: 2 },
				{ eventType: "fired", subscribers: 1 },
			],
		});
		collector.recordEvent({ eventType: "fired", subscribers: 1 });

		expect(collector.getSnapshot().scenarios).toEqual([
			{ eventType: "fired", subscribers: 1, dispatches: 1 },
			{ eventType: "never:fired", subscribers: 2, dispatches: 0 },
		]);
	});

	it("lists an event that was fired without being registered", () => {
		const collector = new LankaDevtoolsCollector({ clock });

		collector.recordEvent({ eventType: "ad:hoc", subscribers: 0 });

		expect(collector.getSnapshot().scenarios).toEqual([
			{ eventType: "ad:hoc", subscribers: 0, dispatches: 1 },
		]);
	});

	it("keeps requests within their bound", () => {
		const collector = new LankaDevtoolsCollector({ clock, maxRequests: 2 });

		for (const endpoint of ["/a", "/b", "/c"]) {
			collector.recordRequest({ endpoint, durationMs: 1, outcome: "ok" });
		}

		expect(collector.getSnapshot().requests.map((r) => r.endpoint)).toEqual(["/b", "/c"]);
	});

	it("tells a subscriber once for a burst in one turn", async () => {
		// Twenty events in one turn must not become twenty redraws, or reading the
		// inspector becomes the reason the application is slow.
		const collector = new LankaDevtoolsCollector({ clock });
		const changed = vi.fn();
		collector.subscribe(changed);

		for (let index = 0; index < 20; index += 1) {
			collector.recordEvent({ eventType: "burst", subscribers: 0 });
		}
		await Promise.resolve();

		expect(changed).toHaveBeenCalledTimes(1);
	});

	it("stops telling a subscriber that unsubscribed", async () => {
		const collector = new LankaDevtoolsCollector({ clock });
		const changed = vi.fn();

		collector.subscribe(changed)();
		collector.recordEvent({ eventType: "quiet", subscribers: 0 });
		await Promise.resolve();

		expect(changed).not.toHaveBeenCalled();
	});

	it("forgets what it collected, and keeps collecting", () => {
		const collector = new LankaDevtoolsCollector({ clock });
		collector.recordEvent({ eventType: "before", subscribers: 0 });

		collector.clear();
		collector.recordEvent({ eventType: "after", subscribers: 0 });

		expect(collector.getSnapshot().events).toHaveLength(1);
		expect(collector.getSnapshot().scenarios).toEqual([
			{ eventType: "after", subscribers: 0, dispatches: 1 },
		]);
	});
});
