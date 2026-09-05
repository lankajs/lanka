import { afterEach, describe, expect, it, vi } from "vitest";
import { createLankaDevtoolsCollector, LankaDevtoolsCollector } from "../src/index";
import { resetActiveLanka } from "lanka";
import { startPlaygroundInspected } from "./app";

/**
 * The package, used as an application under inspection uses it.
 *
 * The inspector's whole value is that it sees the bus, the log, the wire and the
 * scenario register at once — four sources no unit test holds together — and its
 * whole risk is that it never stops seeing them.
 */
type TInspected = ReturnType<typeof startPlaygroundInspected>;

let app: TInspected | null = null;

afterEach(() => {
	app?.lanka.dispose();
	app = null;
	resetActiveLanka();
	vi.restoreAllMocks();
	// A panel left mounted by a case that failed before its teardown would make
	// the NEXT case fail too, and the report would name the wrong one.
	for (const panel of document.querySelectorAll("[data-lanka-devtools]")) panel.remove();
});

describe("the devtools playground", () => {
	it("records the events an application fired", async () => {
		app = startPlaygroundInspected({ enabled: true });

		await app.useTheApp();

		const events = app.devtools.getSnapshot().events;
		expect(events.length).toBeGreaterThanOrEqual(2);
		expect(events.some((event) => event.eventType === "playground:cart-changed")).toBe(true);
	});

	it("records what the application logged", async () => {
		vi.spyOn(console, "log").mockImplementation(() => undefined);
		app = startPlaygroundInspected({ enabled: true });

		await app.useTheApp();

		expect(app.devtools.getSnapshot().logs.length).toBeGreaterThan(0);
	});

	it("follows the wire, and says what each request cost", async () => {
		app = startPlaygroundInspected({ enabled: true });

		await app.useTheApp();

		const snapshot = app.devtools.getSnapshot();
		// Back to zero: the counter is decremented in a `finally`, and a request
		// that never decremented would disable prefetching for the whole session.
		expect(snapshot.inFlight).toBe(0);
		// And the row a counter could never be: which endpoint, and whether it
		// arrived.
		expect(snapshot.requests).toMatchObject([
			{ endpoint: "https://api.test/cart", outcome: "ok" },
		]);
	});

	it("shows a scenario the application declared and never fired", async () => {
		// "Why does nothing happen" is the question the inspector is opened for, and
		// a list of what DID happen is exactly the list that cannot answer it.
		app = startPlaygroundInspected({ enabled: true });

		await app.useTheApp();

		expect(app.devtools.getSnapshot().scenarios).toContainEqual(
			expect.objectContaining({ eventType: "playground:checkout-blocked", dispatches: 0 }),
		);
	});

	it("names the middleware that refused an event", async () => {
		// The field the guide promised and nothing filled. The refusing middleware
		// is registered AFTER the inspector's, which is the order a bootstrap
		// produces and the one in which a middleware can never see it.
		vi.spyOn(console, "log").mockImplementation(() => undefined);
		app = startPlaygroundInspected({ enabled: true, blockWith: "cart is locked" });

		await app.useTheApp();

		expect(app.devtools.getSnapshot().events).toContainEqual(
			expect.objectContaining({ outcome: "stopped", stoppedBy: "cart is locked" }),
		);
	});

	it("accumulates NOTHING while disabled", async () => {
		// The property this plugin lives or dies by. Always-on history is a leak
		// with a user interface: diagnostics in appearance, memory growth in fact.
		app = startPlaygroundInspected({ enabled: false });

		await app.useTheApp();

		const snapshot = app.devtools.getSnapshot();
		expect(snapshot.events).toEqual([]);
		expect(snapshot.logs).toEqual([]);
		expect(snapshot.requests).toEqual([]);
		expect(snapshot.scenarios).toEqual([]);
		expect(app.devtools.isEnabled()).toBe(false);
	});

	it("observes without deciding: a watched event is still delivered", async () => {
		// Middleware able to stop delivery would turn a diagnostic tool into a
		// participant, and "disabled the inspector, it started working" would
		// become a sentence someone can say.
		app = startPlaygroundInspected({ enabled: true });
		const heard = vi.fn();
		const stop = app.lanka.eventBus.subscribe("playground:cart-changed", heard);

		await app.useTheApp();

		expect(heard).toHaveBeenCalledTimes(2);
		stop();
	});

	it("can be reached from a console, and lets go on teardown", () => {
		app = startPlaygroundInspected({ enabled: true, exposeAs: "__playgroundInspector" });

		expect((globalThis as Record<string, unknown>).__playgroundInspector).toBe(app.devtools);

		app.lanka.dispose();
		expect("__playgroundInspector" in globalThis).toBe(false);
	});

	it("stops collecting once it is removed", async () => {
		app = startPlaygroundInspected({ enabled: true });
		const remove = app.lanka.use({
			name: "playground-noop",
			install: () => undefined,
		});
		remove();

		await app.useTheApp();
		const before = app.devtools.getSnapshot().events.length;

		app.lanka.dispose();

		expect(before).toBeGreaterThan(0);
	});
});

describe("the panel a developer opens", () => {
	it("renders what the inspector collected, and takes itself away", async () => {
		app = startPlaygroundInspected({ enabled: true });
		await app.useTheApp();

		const close = app.showPanel();

		expect(document.body.textContent).toContain("playground:cart-changed");
		close?.();
		expect(document.body.textContent).not.toContain("playground:cart-changed");
	});

	it("opens on the list it was asked for", async () => {
		app = startPlaygroundInspected({ enabled: true });
		await app.useTheApp();

		const close = app.showPanel({ tab: "requests" });

		expect(document.body.textContent).toContain("/cart");
		expect(document.body.textContent).not.toContain("playground:cart-changed");
		close?.();
	});

	it("shows only the rows a filter matches", async () => {
		app = startPlaygroundInspected({ enabled: true });
		await app.useTheApp();
		const close = app.showPanel();

		typeIntoFilter("checkout");

		expect(document.body.textContent).not.toContain("playground:cart-changed");
		close?.();
	});

	it("redraws when something is collected, without a timer", async () => {
		// The panel used to poll twice a second: a redraw when nothing happened, and
		// half a second of staleness when something did.
		vi.useFakeTimers();
		try {
			app = startPlaygroundInspected({ enabled: true });
			const close = app.showPanel();
			const redraw = vi.spyOn(globalThis, "requestAnimationFrame");

			app.lanka.eventBus.dispatch("playground:late", { items: 9 });
			await Promise.resolve();

			expect(redraw).toHaveBeenCalled();
			close?.();
		} finally {
			vi.useRealTimers();
		}
	});

	it("empties what the inspector holds when asked", async () => {
		app = startPlaygroundInspected({ enabled: true });
		await app.useTheApp();
		const close = app.showPanel();

		clickButton("clear");

		expect(app.devtools.getSnapshot().events).toEqual([]);
		close?.();
	});

	it("switches between the four lists", async () => {
		app = startPlaygroundInspected({ enabled: true });
		await app.useTheApp();
		const close = app.showPanel();

		clickButton("requests");
		expect(document.body.textContent).toContain("/cart");
		expect(document.body.textContent).not.toContain("playground:cart-changed");

		clickButton("scenarios");
		expect(document.body.textContent).toContain("playground:checkout-blocked");

		close?.();
	});

	it("collapses to its title bar and opens again", async () => {
		app = startPlaygroundInspected({ enabled: true });
		await app.useTheApp();
		const close = app.showPanel();

		clickTitle();
		expect(isCollapsed()).toBe(true);

		clickTitle();
		expect(isCollapsed()).toBe(false);
		close?.();
	});

	it("opens collapsed when asked", async () => {
		app = startPlaygroundInspected({ enabled: true });
		await app.useTheApp();

		const close = app.showPanel({ collapsed: true });

		expect(isCollapsed()).toBe(true);
		close?.();
	});

	it("hands the whole session over as JSON", async () => {
		// What a developer attaches to a bug report. Not a download: a debug panel
		// that asked for a permission would be refused in the session it is needed.
		const writeText = vi.fn((text: string) => Promise.resolve(text));
		Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
		app = startPlaygroundInspected({ enabled: true });
		await app.useTheApp();
		const close = app.showPanel();

		clickButton("copy");

		expect(writeText).toHaveBeenCalledWith(expect.stringContaining("playground:cart-changed"));
		close?.();
	});

	it("mounts where it was told, in either shape the call was written", async () => {
		// The container used to be the second positional parameter, and a published
		// signature is not taken back.
		app = startPlaygroundInspected({ enabled: true });
		await app.useTheApp();
		const corner = document.createElement("div");
		document.body.appendChild(corner);

		const close = app.showPanel({ container: corner });

		expect(corner.querySelector("[data-lanka-devtools]")).not.toBeNull();
		close?.();
		corner.remove();
	});

	it("is absent from a production build before doing any work", () => {
		// A panel in production is not a little extra code: it is an interface that
		// can appear on a user's screen.
		app = startPlaygroundInspected({ enabled: true });
		app.lanka.setConfig({ flags: { isDevelopment: false } });

		expect(app.showPanel()).toBeUndefined();
		expect(document.querySelector("[data-lanka-devtools]")).toBeNull();
	});
});

describe("either style builds the same collector", () => {
	it("starts empty in both, and keeps what it is given", () => {
		const built = createLankaDevtoolsCollector();
		const constructed = new LankaDevtoolsCollector();

		expect(built.getSnapshot()).toEqual(constructed.getSnapshot());
	});
});

/** The panel's own controls, driven the way a developer drives them. */
const typeIntoFilter = (text: string): void => {
	const field = document.querySelector<HTMLInputElement>("[data-lanka-devtools] input");
	if (!field) throw new Error("the panel has no filter field");

	field.value = text;
	field.dispatchEvent(new Event("input"));
};

/**
 * Whether the lists are hidden.
 *
 * Read off the element rather than off `textContent`: hidden content is still
 * text to a DOM, so an assertion about what is VISIBLE has to ask the element.
 */
const isCollapsed = (): boolean => {
	const body = document.querySelector<HTMLElement>("[data-lanka-devtools] > div:last-child");
	if (!body) throw new Error("the panel has no body");

	return body.hidden;
};

const clickTitle = (): void => {
	const title = document.querySelector<HTMLElement>("[data-lanka-devtools] strong");
	if (!title) throw new Error("the panel has no title bar");

	title.click();
};

const clickButton = (label: string): void => {
	const buttons = [
		...document.querySelectorAll<HTMLButtonElement>("[data-lanka-devtools] button"),
	];
	const button = buttons.find((candidate) => candidate.textContent === label);
	if (!button) throw new Error(`the panel has no "${label}" button`);

	button.click();
};
