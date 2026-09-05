import { describe, expect, it } from "vitest";
import { lankaDevtoolsPanelRows } from "./lankaDevtoolsPanelRows";
import type { ILankaDevtoolsSnapshot } from "../../../collector/LankaDevtoolsCollector";

/**
 * What the panel SAYS, tested without a document.
 *
 * The rows are the part a developer reads, and a test that mounted DOM to check
 * them would assert on element trees instead of on sentences — and would then
 * fail on every change to the styling it was never about.
 */
const snapshot = (over: Partial<ILankaDevtoolsSnapshot> = {}): ILankaDevtoolsSnapshot => ({
	events: [],
	logs: [],
	requests: [],
	scenarios: [],
	inFlight: 0,
	...over,
});

describe("lankaDevtoolsPanelRows", () => {
	it("shows events newest first — an inspector is read after something happened", () => {
		const rows = lankaDevtoolsPanelRows(
			snapshot({
				events: [
					{ at: 1, eventType: "first", subscribers: 1, outcome: "delivered" },
					{ at: 2, eventType: "second", subscribers: 1, outcome: "delivered" },
				],
			}),
			"events",
		);

		expect(rows.map((row) => row.text)).toEqual(["second → 1", "first → 1"]);
	});

	it("names the middleware that stopped an event, and marks the row", () => {
		// The answer to "why did nothing happen when I dispatched that" — the
		// question the whole outcome mechanism exists for.
		const rows = lankaDevtoolsPanelRows(
			snapshot({
				events: [
					{
						at: 1,
						eventType: "cart:changed",
						subscribers: 3,
						outcome: "stopped",
						stoppedBy: "not signed in",
					},
				],
			}),
			"events",
		);

		expect(rows[0].text).toBe("cart:changed → 3 [stopped] not signed in");
		expect(rows[0].tone).toBe("bad");
	});

	it("marks a failed request and keeps its duration", () => {
		const rows = lankaDevtoolsPanelRows(
			snapshot({
				requests: [
					{ at: 1, endpoint: "/api/todos", durationMs: 12, outcome: "ok" },
					{
						at: 2,
						endpoint: "/api/profile",
						durationMs: 900,
						outcome: "failed",
						error: "Network error",
					},
				],
			}),
			"requests",
		);

		expect(rows[0].text).toBe("/api/profile · 900ms · Network error");
		expect(rows[0].tone).toBe("bad");
		expect(rows[1].tone).toBeUndefined();
	});

	it("marks a scenario nobody listens to, and one that never fired", () => {
		// Both are what "my scenario does not work" actually turns out to be, and
		// neither is visible in a list of what DID happen.
		const rows = lankaDevtoolsPanelRows(
			snapshot({
				scenarios: [
					{ eventType: "heard", subscribers: 2, dispatches: 5 },
					{ eventType: "unheard", subscribers: 0, dispatches: 5 },
					{ eventType: "unfired", subscribers: 2, dispatches: 0 },
				],
			}),
			"scenarios",
		);

		expect(rows.map((row) => row.tone)).toEqual([undefined, "quiet", "quiet"]);
		expect(rows[0].text).toBe("heard · 2 subs · 5×");
	});

	it("keeps the scenario register in its own order", () => {
		// A register read down, not a history read up: reversing it would move a row
		// every time something fired.
		const rows = lankaDevtoolsPanelRows(
			snapshot({
				scenarios: [
					{ eventType: "a", subscribers: 1, dispatches: 1 },
					{ eventType: "b", subscribers: 1, dispatches: 1 },
				],
			}),
			"scenarios",
		);

		expect(rows.map((row) => row.text.split(" ")[0])).toEqual(["a", "b"]);
	});

	it("marks a warning and an error in the log", () => {
		const rows = lankaDevtoolsPanelRows(
			snapshot({
				logs: [
					{ at: 1, layer: "GW", level: "log", message: "fine" },
					{ at: 2, layer: "GW", level: "error", message: "not fine" },
				],
			}),
			"logs",
		);

		expect(rows[0]).toEqual({ text: "GW not fine", tone: "bad" });
		expect(rows[1].tone).toBeUndefined();
	});

	it("filters case-insensitively, and an empty filter keeps everything", () => {
		const withEvents = snapshot({
			events: [
				{ at: 1, eventType: "cart:changed", subscribers: 1, outcome: "delivered" },
				{ at: 2, eventType: "session:ended", subscribers: 1, outcome: "delivered" },
			],
		});

		expect(lankaDevtoolsPanelRows(withEvents, "events", "CART")).toHaveLength(1);
		expect(lankaDevtoolsPanelRows(withEvents, "events", "  ")).toHaveLength(2);
		expect(lankaDevtoolsPanelRows(withEvents, "events", "nothing")).toHaveLength(0);
	});
});
