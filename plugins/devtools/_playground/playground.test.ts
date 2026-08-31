import { afterEach, describe, expect, it, vi } from "vitest";
import { createLankaDevtoolsCollector, LankaDevtoolsCollector } from "../src/index";
import { resetActiveLanka } from "lanka";
import { startPlaygroundInspected } from "./app";

/**
 * The package, used as an application under inspection uses it.
 *
 * The inspector's whole value is that it sees the bus, the log and the wire at
 * once — three sources no unit test holds together — and its whole risk is that
 * it never stops seeing them.
 */
type TInspected = ReturnType<typeof startPlaygroundInspected>;

let app: TInspected | null = null;

afterEach(() => {
	app?.lanka.dispose();
	app = null;
	resetActiveLanka();
	vi.restoreAllMocks();
});

describe("the devtools playground", () => {
	it("records the events an application fired", () => {
		app = startPlaygroundInspected(true);

		app.useTheApp();

		const events = app.devtools.getSnapshot().events;
		expect(events.length).toBeGreaterThanOrEqual(2);
		expect(events.some((event) => event.eventType === "playground:cart-changed")).toBe(true);
	});

	it("records what the application logged", () => {
		vi.spyOn(console, "log").mockImplementation(() => undefined);
		app = startPlaygroundInspected(true);

		app.useTheApp();

		expect(app.devtools.getSnapshot().logs.length).toBeGreaterThan(0);
	});

	it("follows the wire", () => {
		app = startPlaygroundInspected(true);

		app.useTheApp();

		// Back to zero: the counter is decremented in a `finally`, and a request
		// that never decremented would disable prefetching for the whole session.
		expect(app.devtools.getSnapshot().inFlight).toBe(0);
	});

	it("accumulates NOTHING while disabled", () => {
		// The property this plugin lives or dies by. Always-on history is a leak
		// with a user interface: diagnostics in appearance, memory growth in fact.
		app = startPlaygroundInspected(false);

		app.useTheApp();

		const snapshot = app.devtools.getSnapshot();
		expect(snapshot.events).toEqual([]);
		expect(snapshot.logs).toEqual([]);
		expect(app.devtools.isEnabled()).toBe(false);
	});

	it("observes without deciding: a watched event is still delivered", () => {
		// Middleware able to stop delivery would turn a diagnostic tool into a
		// participant, and "disabled the inspector, it started working" would
		// become a sentence someone can say.
		app = startPlaygroundInspected(true);
		const heard = vi.fn();
		const stop = app.lanka.eventBus.subscribe("playground:cart-changed", heard);

		app.useTheApp();

		expect(heard).toHaveBeenCalledTimes(2);
		stop();
	});

	it("stops collecting once it is removed", () => {
		app = startPlaygroundInspected(true);
		const remove = app.lanka.use({
			name: "playground-noop",
			install: () => undefined,
		});
		remove();

		app.useTheApp();
		const before = app.devtools.getSnapshot().events.length;

		app.lanka.dispose();
		app = { ...app, lanka: app.lanka };

		expect(before).toBeGreaterThan(0);
	});
});

describe("the panel a developer opens", () => {
	it("renders what the inspector collected, and takes itself away", () => {
		app = startPlaygroundInspected(true);
		app.useTheApp();

		const close = app.showPanel();

		expect(document.body.textContent).toContain("playground:cart-changed");
		close?.();
		expect(document.body.textContent).not.toContain("playground:cart-changed");
	});
});

describe("either style builds the same collector", () => {
	it("starts empty in both, and keeps what it is given", () => {
		const built = createLankaDevtoolsCollector();
		const constructed = new LankaDevtoolsCollector();

		expect(built.getSnapshot()).toEqual(constructed.getSnapshot());
	});
});
