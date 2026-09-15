// @vitest-environment node
import { JSDOM } from "jsdom";
import { createAtlasServer } from "@lanka-playgrounds/_server";
import { resetActiveLanka } from "lanka/bootstrap";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { mountAtlasVanilla } from "./mountAtlasVanilla";
import { startAtlasVanilla } from "./startAtlasVanilla";
import type { IAtlasServer } from "@lanka-playgrounds/_server";
import type { IMountedAtlasVanilla } from "./mountAtlasVanilla";

/**
 * The framework-free application against the real API.
 *
 * `@vitest-environment node` for the reason every live suite here states: under
 * jsdom the `AbortController` is jsdom's and `fetch` is node's, and node's fetch
 * refuses a signal built in another realm — so every request the framework sends
 * fails as `kind: "network"` after spending the whole retry ladder, and reads
 * exactly like a server that is not there.
 *
 * But this application PAINTS, and the other live suites do not. So the DOM is
 * installed by hand, from the jsdom this package already depends on, and only
 * `document` is put on the global: `fetch`, `AbortController` and `Event` stay
 * node's, which is the division that makes both halves work at once.
 *
 * What only this file can show: that `startAtlas` — five plugins, a transport, a
 * validator, scenarios, a session — runs to completion with no UI framework
 * anywhere in the process, and that what it hands back paints.
 */
const dom = new JSDOM("<!doctype html><html><body></body></html>");

beforeAll(() => {
	// `document` and nothing else. Assigned rather than replaced wholesale
	// because a jsdom `window` would bring its own `AbortController` with it, and
	// that is the exact collision the node environment is here to avoid.
	(globalThis as { document?: Document }).document = dom.window.document;
});

let api: IAtlasServer;
let base: string;
let mounted: IMountedAtlasVanilla | null = null;

beforeAll(async () => {
	api = createAtlasServer({ callsPerToken: 50 });
	base = await api.listen(0);
});

afterEach(() => {
	mounted?.stop();
	mounted = null;
	dom.window.document.body.replaceChildren();
	api.world.reset();
	resetActiveLanka();
});

afterAll(async () => {
	await api.close();
});

const root = (): HTMLElement => {
	const main = dom.window.document.createElement("main");
	dom.window.document.body.append(main);

	return main;
};

const mount = async (): Promise<IMountedAtlasVanilla> => {
	mounted = await mountAtlasVanilla({ root: root(), apiBaseUrl: base, connect: false });

	return mounted;
};

describe("starting the framework with no framework", () => {
	it("starts, signs in and hands back a running application", async () => {
		const vanilla = await startAtlasVanilla({ apiBaseUrl: base, connect: false });

		expect(vanilla.app.session.current()?.name).toBe("Ada");
		vanilla.stop();
	});

	it("disposes what it started, so a second start is not a second instance", async () => {
		const first = await startAtlasVanilla({ apiBaseUrl: base, connect: false });
		first.stop();

		const second = await startAtlasVanilla({ apiBaseUrl: base, connect: false });

		expect(second.app.session.current()?.name).toBe("Ada");
		second.stop();
	});
});

describe("the whole application, mounted and painting", () => {
	it("paints rows the real server answered with", async () => {
		const vanilla = await mount();

		const painted = [...vanilla.root.querySelectorAll('[data-testid="missions"] li')].map(
			(item) => item.textContent,
		);

		expect(vanilla.operator).toBe("Ada");
		expect(painted.length).toBeGreaterThan(0);
	});

	it("puts both screens on the page", async () => {
		const vanilla = await mount();

		expect(vanilla.root.querySelectorAll("section")).toHaveLength(2);
		expect(vanilla.root.querySelector('[data-testid="board-summary"]')).not.toBeNull();
	});

	it("repaints from a real action, over the real wire", async () => {
		const vanilla = await mount();
		const before = vanilla.root.querySelectorAll('[data-testid="missions"] li').length;

		const search = vanilla.root.querySelector("input");
		search!.value = "zzzz-nothing-matches-this";
		search!.dispatchEvent(new dom.window.Event("input"));

		const after = vanilla.root.querySelectorAll('[data-testid="missions"] li').length;

		expect(before).toBeGreaterThan(0);
		expect(after).toBe(0);
	});

	it("can be mounted twice in one process", async () => {
		// A module-level ViewModel is one store per PROCESS. Building them inside
		// the mount is what lets a suite — or a server — have two, and it is the one
		// thing this application does differently from the browser one.
		const first = await mountAtlasVanilla({ root: root(), apiBaseUrl: base, connect: false });
		const second = await mountAtlasVanilla({ root: root(), apiBaseUrl: base, connect: false });

		expect(second.root.querySelectorAll("section")).toHaveLength(2);
		first.stop();
		second.stop();
	});

	it("takes both screens down when it stops", async () => {
		const vanilla = await mount();
		const painted = vanilla.root.querySelectorAll('[data-testid="missions"] li').length;

		vanilla.stop();
		mounted = null;

		// Still on the page — teardown releases SUBSCRIPTIONS, not nodes. Whoever
		// owns the element owns emptying it, and conflating the two is how a
		// framework ends up owning the document.
		expect(vanilla.root.querySelectorAll('[data-testid="missions"] li')).toHaveLength(painted);
	});
});
