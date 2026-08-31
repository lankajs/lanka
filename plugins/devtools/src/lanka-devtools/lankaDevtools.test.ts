import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLanka, type ILankaInstance } from "lanka";
import { lankaLogger } from "lanka/logger";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { lankaDevtools } from "./lankaDevtools";
import { renderLankaDevtoolsPanel } from "../panel/renderLankaDevtoolsPanel";

/**
 * The inspector.
 *
 * The main assertion is about what it does NOT do: disabled, it accumulates
 * nothing. Always-on history is a leak with a user interface — it looks like
 * diagnostics and behaves as slow memory growth.
 */

let lanka: ILankaInstance;

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
		const cleanup = renderLankaDevtoolsPanel(() => ({ events: [], logs: [], inFlight: 0 }));

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
			const snapshot = vi.fn(() => ({ events: [], logs: [], inFlight: 0 }));
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
