import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLanka, resetActiveLanka, type ILankaInstance } from "lanka";
import { lankaLogger } from "lanka/logger";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { createLankaFakeTransport } from "@lankajs/tool-testing";
import { LankaFetchJsonRequest } from "lanka/gateway";
import { lankaDevtools } from "./lankaDevtools";
import { renderLankaDevtoolsPanel } from "../panel/renderLankaDevtoolsPanel";
import type { ILankaDevtoolsSnapshot } from "../lanka-devtools-collector/LankaDevtoolsCollector";

/**
 * The inspector.
 *
 * The main assertion is about what it does NOT do: disabled, it accumulates
 * nothing. Always-on history is a leak with a user interface — it looks like
 * diagnostics and behaves as slow memory growth.
 */

let lanka: ILankaInstance;

/** Nothing collected — what a disabled inspector answers, and what a panel with
 * no plugin behind it is handed. */
const nothing = (): ILankaDevtoolsSnapshot => ({
	events: [],
	logs: [],
	requests: [],
	scenarios: [],
	inFlight: 0,
});

const dispatch = (eventType: string): void => {
	lanka.eventBus.registerEvent(eventType, { usedBy: ["test"] });
	lanka.eventBus.dispatch(eventType, { id: 1 });
};

afterEach(() => {
	vi.restoreAllMocks();
});

describe("inspector disabled", () => {
	beforeEach(() => {
		lanka = createLanka({ host: lankaTestHost, flags: { isProduction: true } });
	});

	it("accumulates no events", () => {
		const plugin = lankaDevtools();
		lanka.use(plugin);

		dispatch("gap.updated");

		expect(plugin.isEnabled()).toBe(false);
		expect(plugin.getSnapshot().events).toEqual([]);
	});

	it("does not subscribe to the logger", () => {
		const addSink = vi.spyOn(lankaLogger, "addSink");
		lanka.use(lankaDevtools());

		expect(addSink).not.toHaveBeenCalled();
	});

	it("the panel does not render outside development", () => {
		// Returning `undefined` before doing any work lets the consumer's bundler
		// remove the function body and everything it references. A panel in a
		// production build is not a little extra code but an interface that can
		// appear on a user's screen.
		const cleanup = renderLankaDevtoolsPanel(nothing);

		expect(cleanup).toBeUndefined();
		expect(document.querySelector("[data-lanka-devtools]")).toBeNull();
	});
});

describe("inspector enabled", () => {
	beforeEach(() => {
		lanka = createLanka({ host: lankaTestHost, flags: { isDevelopment: true } });
	});

	it("records dispatched events", () => {
		const plugin = lankaDevtools();
		lanka.use(plugin);

		dispatch("gap.updated");

		expect(plugin.getSnapshot().events).toMatchObject([{ eventType: "gap.updated" }]);
	});

	it("does not halt delivery", () => {
		// The inspector OBSERVES. Middleware able to stop delivery would turn a
		// diagnostic tool into a participant, and "disabled the inspector, it
		// started working" would become a possible sentence.
		const handler = vi.fn();
		lanka.use(lankaDevtools());
		lanka.eventBus.registerEvent("gap.updated", { usedBy: ["test"] });
		lanka.eventBus.subscribe("gap.updated", handler, { usedBy: "test" });

		lanka.eventBus.dispatch("gap.updated", { id: 1 });

		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("keeps a known bound on history", () => {
		// An inspector accumulating without a bound is a leak visible only in a long
		// session.
		const plugin = lankaDevtools({ maxEvents: 3 });
		lanka.use(plugin);

		for (let index = 0; index < 10; index += 1) dispatch(`event.${String(index)}`);

		expect(plugin.getSnapshot().events).toHaveLength(3);
		expect(plugin.getSnapshot().events.at(-1)?.eventType).toBe("event.9");
	});

	it("sees the in-flight request counter", () => {
		const plugin = lankaDevtools();
		lanka.use(plugin);

		lanka.inFlight.begin();

		expect(plugin.getSnapshot().inFlight).toBe(1);
		lanka.inFlight.end();
	});

	it("collects log lines", () => {
		// The logger is silent until enabled: the inspector's sink receives exactly
		// what the console does and cannot receive more.
		lanka = createLanka({
			host: lankaTestHost,
			flags: { isDevelopment: true, loggerEnabled: true, loggerBootstrap: true },
		});
		const plugin = lankaDevtools();
		lanka.use(plugin);

		lankaLogger.printBootstrapLog("a bootstrap message");

		expect(plugin.getSnapshot().logs.at(-1)?.message).toContain("a bootstrap message");
	});

	it("removing the plugin detaches the sink and clears what was collected", () => {
		const plugin = lankaDevtools();
		const remove = lanka.use(plugin);
		dispatch("gap.updated");

		remove();

		expect(plugin.getSnapshot().events).toEqual([]);
		lankaLogger.printBootstrapLog("after removal");
		expect(plugin.getSnapshot().logs).toEqual([]);
	});

	it("the panel renders and tears down", () => {
		const plugin = lankaDevtools();
		lanka.use(plugin);
		dispatch("gap.updated");

		const cleanup = renderLankaDevtoolsPanel(() => plugin.getSnapshot());

		const panel = document.querySelector("[data-lanka-devtools]");
		expect(panel?.textContent).toContain("gap.updated");

		cleanup?.();
		expect(document.querySelector("[data-lanka-devtools]")).toBeNull();
	});

	it("the panel leaves no timer behind after teardown", () => {
		// A leftover interval keeps reading a dead plugin's snapshot and holds it in
		// memory together with all the history it collected.
		vi.useFakeTimers();
		try {
			const snapshot = vi.fn(nothing);
			const cleanup = renderLankaDevtoolsPanel(snapshot);
			cleanup?.();
			snapshot.mockClear();

			vi.advanceTimersByTime(5_000);

			expect(snapshot).not.toHaveBeenCalled();
		} finally {
			vi.useRealTimers();
		}
	});
});

describe("inspector enabled — what the bus, the wire and the console add up to", () => {
	beforeEach(() => {
		lanka = createLanka({ host: lankaTestHost, flags: { isDevelopment: true } });
	});

	it("names the middleware that stopped an event", () => {
		// The field the guide documented and no code path ever filled: the
		// inspector's middleware is registered FIRST, so it cannot see a later
		// middleware's decision. The bus reports it instead.
		vi.spyOn(lankaLogger, "printScenarioLog").mockImplementation(() => undefined);
		const plugin = lankaDevtools();
		lanka.use(plugin);
		lanka.eventBus.addMiddleware(() => ({ stop: "not signed in" }));

		dispatch("gap.updated");

		expect(plugin.getSnapshot().events).toMatchObject([
			{ eventType: "gap.updated", outcome: "stopped", stoppedBy: "not signed in" },
		]);
	});

	it("marks a delivered event as delivered", () => {
		const plugin = lankaDevtools();
		lanka.use(plugin);

		dispatch("gap.updated");

		expect(plugin.getSnapshot().events[0].outcome).toBe("delivered");
	});

	it("lists a scenario that is registered and has never fired", () => {
		const plugin = lankaDevtools();
		lanka.use(plugin);
		lanka.eventBus.registerEvent("never.fired", { usedBy: ["test"] });

		expect(plugin.getSnapshot().scenarios).toMatchObject([
			{ eventType: "never.fired", dispatches: 0 },
		]);
	});

	it("times a request and records that it arrived", async () => {
		const plugin = lankaDevtools();
		lanka.use(plugin);
		const transport = createLankaFakeTransport({ body: { ok: true } });

		await new LankaFetchJsonRequest({ transport }).execute("/api/things");

		expect(plugin.getSnapshot().requests).toMatchObject([
			{ endpoint: "/api/things", outcome: "ok" },
		]);
	});

	it("records a failed request and lets the failure through untouched", async () => {
		// The inspector observes and does not decide, in the second place that rule
		// has to hold: a wrapper that swallowed a failure would make the application
		// behave differently while being watched.
		const plugin = lankaDevtools();
		lanka.use(plugin);
		const transport = createLankaFakeTransport({
			failWith: () => new TypeError("Failed to fetch"),
		});

		await expect(
			new LankaFetchJsonRequest({ transport }).execute("/api/things"),
		).rejects.toMatchObject({ kind: "network" });

		expect(plugin.getSnapshot().requests).toMatchObject([
			{ endpoint: "/api/things", outcome: "failed" },
		]);
	});

	it("tells a panel that something changed, once per turn", async () => {
		const plugin = lankaDevtools();
		lanka.use(plugin);
		const changed = vi.fn();
		plugin.subscribe(changed);

		dispatch("gap.updated");
		dispatch("gap.updated");
		await Promise.resolve();

		expect(changed).toHaveBeenCalledTimes(1);
	});

	it("forgets what it collected on request, and keeps collecting", () => {
		const plugin = lankaDevtools();
		lanka.use(plugin);
		dispatch("gap.updated");

		plugin.clear();
		dispatch("gap.updated");

		expect(plugin.getSnapshot().events).toHaveLength(1);
	});

	it("puts itself where a console can reach it, and takes itself away", () => {
		const plugin = lankaDevtools({ exposeAs: "__playgroundDevtools" });
		const remove = lanka.use(plugin);

		expect((globalThis as Record<string, unknown>).__playgroundDevtools).toBe(plugin);

		remove();
		expect("__playgroundDevtools" in globalThis).toBe(false);
	});

	it("exposes nothing while it is disabled", () => {
		// A global left behind by a disabled inspector is a reference to everything
		// the inspector holds, in a build that was supposed to drop it.
		lanka = createLanka({ host: lankaTestHost, flags: { isProduction: true } });
		lanka.use(lankaDevtools({ exposeAs: "__shouldNotExist" }));

		expect("__shouldNotExist" in globalThis).toBe(false);
	});
});

describe("the panel's own wiring", () => {
	beforeEach(() => {
		lanka = createLanka({ host: lankaTestHost, flags: { isDevelopment: true } });
	});

	it("still accepts the container in the position it used to take", () => {
		// A published signature is not taken back. The options object was ADDED to
		// this parameter, so a call written before it keeps working and keeps
		// mounting where it said.
		const corner = document.createElement("div");
		document.body.appendChild(corner);

		const cleanup = renderLankaDevtoolsPanel(nothing, corner);

		expect(corner.querySelector("[data-lanka-devtools]")).not.toBeNull();
		cleanup?.();
		corner.remove();
	});

	it("redraws once for a burst of notifications inside one frame", () => {
		// The second half of the coalescing. The collector already folds a turn's
		// worth of events into one notification; this folds several turns' worth
		// into one repaint.
		const frame = vi.spyOn(globalThis, "requestAnimationFrame").mockReturnValue(1);
		let notify = (): void => undefined;
		const cleanup = renderLankaDevtoolsPanel(nothing, {
			subscribe: (listener) => {
				notify = listener;
				return () => undefined;
			},
		});

		notify();
		notify();
		notify();

		expect(frame).toHaveBeenCalledTimes(1);
		cleanup?.();
	});

	it("answers no scenarios rather than throwing when nothing is active", () => {
		// A snapshot may be asked for before the instance is active — a panel
		// mounting early, a test reading a plugin it has not installed. Reading a
		// diagnostic tool must not be a way to crash.
		const plugin = lankaDevtools({ enabled: true });
		resetActiveLanka();

		expect(plugin.getSnapshot().scenarios).toEqual([]);
	});
});
