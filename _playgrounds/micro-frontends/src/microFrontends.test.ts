import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { atlasMissionAssigned } from "@lanka-playgrounds/_shared";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { resetActiveLanka, startLanka } from "lanka/bootstrap";
import { screen, waitFor, within } from "@testing-library/dom";
import type { IAtlasMission } from "@lanka-playgrounds/_shared";
import type { TLankaSharing } from "./Core/Build/buildMicroFrontend";

/**
 * Two modules, two frameworks, two SEPARATE builds, one page.
 *
 * `vitest.globalSetup.ts` built each module with `vite build` before this file
 * ran, and what is loaded below is the bundle, not the source. The shell is this
 * file: it starts lanka once, puts two elements on the page and hands each
 * module one — which is all a shell does in a micro-frontend arrangement,
 * whatever loads the bundles in production.
 *
 * ## What the modules share, and what they do not
 *
 * Each bundle carries its OWN copy of the application: the ViewModel factory,
 * the binding, and the definition of `atlasMissionAssigned`. The shell triggers
 * a third copy of that definition, imported from source. What is common is
 * `lanka` alone, and that is the claim — `ARCHITECTURE.md`, "Several frameworks
 * in one application", says why it is enough.
 */

/** The contract every module's entry keeps. */
interface IMissionsModule {
	mountMissionsReact?: (element: Element, missions: readonly IAtlasMission[]) => () => void;
	mountMissionsVue?: (element: Element, missions: readonly IAtlasMission[]) => () => void;
}

/**
 * A bundle, loaded the way a shell loads a remote.
 *
 * The path is relative to this file on purpose: `vitest.config.ts` says why a
 * bundle must be resolved from inside this application.
 */
const loadModule = async (sharing: TLankaSharing, name: string): Promise<IMissionsModule> =>
	(await import(`../dist/${sharing}/${name}.js`)) as IMissionsModule;

const mission = (id: string, title: string, over: Partial<IAtlasMission> = {}): IAtlasMission => ({
	id,
	code: `AT-10${id.replace(/\D/g, "")}`,
	title,
	status: "queued",
	priority: 3,
	crewId: null,
	updatedAt: "2026-09-23T00:00:00.000Z",
	...over,
});

const FROM_THE_SHELL = [
	mission("m-1", "Survey the north ridge"),
	mission("m-2", "Restock the depot"),
];

/** An element for one module, the way a shell reserves a region of its page. */
const region = (): HTMLElement => document.body.appendChild(document.createElement("section"));

const assignConvoy = () =>
	atlasMissionAssigned.trigger({
		id: "m-1",
		crewId: "c-1",
		mission: mission("m-1", "Escort the relay convoy", { crewId: "c-1" }),
	});

/**
 * The shell's start-up, inside each scene rather than in a `beforeAll`.
 *
 * The test kit's setup puts a fresh, unstarted instance in place before every
 * test, so a framework started once for the file is not the active one by the
 * time a scene runs. Starting here is also the order a page has: the shell
 * starts, THEN the remotes arrive.
 */
const startShell = () => startLanka({ host: lankaTestHost, flags: { isDevelopment: true } });

const unmounts: (() => void)[] = [];

afterEach(() => {
	for (const unmount of unmounts.splice(0)) unmount();
	document.body.innerHTML = "";
	vi.restoreAllMocks();
});

afterAll(() => {
	resetActiveLanka();
});

describe("modules built separately, over one lanka", () => {
	it("carries a scenario triggered by the shell into both frameworks", async () => {
		// Loaded AFTER the shell started lanka, which is the order a remote arrives
		// in: its ViewModels are created while the framework is already running.
		await startShell();
		const { mountMissionsReact } = await loadModule("one-lanka", "missions-react");
		const { mountMissionsVue } = await loadModule("one-lanka", "missions-vue");

		unmounts.push(mountMissionsReact!(region(), FROM_THE_SHELL));
		unmounts.push(mountMissionsVue!(region(), FROM_THE_SHELL));

		const react = within(await screen.findByLabelText("Missions in React"));
		const vue = within(screen.getByLabelText("Missions in Vue"));
		await waitFor(() => expect(react.getByText("AT-101 Survey the north ridge")).toBeDefined());
		expect(vue.getByText("AT-101 Survey the north ridge")).toBeDefined();

		assignConvoy();

		await waitFor(() =>
			expect(react.getByText("AT-101 Escort the relay convoy")).toBeDefined(),
		);
		await waitFor(() => expect(vue.getByText("AT-101 Escort the relay convoy")).toBeDefined());
	});
});

describe("a module that bundled its own lanka", () => {
	it("is warned about as it loads, and never hears the shell's scenario", async () => {
		// The accident, reproduced by a bundler rather than described: the build
		// inlined lanka, the module never starts it because the shell already did,
		// and its screen renders — correctly, and forever out of date.
		await startShell();
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

		const { mountMissionsVue } = await loadModule("own-lanka", "missions-vue");

		expect(warn).toHaveBeenCalledWith(expect.stringContaining("two copies of lanka"));

		unmounts.push(mountMissionsVue!(region(), FROM_THE_SHELL));
		const vue = within(await screen.findByLabelText("Missions in Vue"));
		await waitFor(() => expect(vue.getByText("AT-101 Survey the north ridge")).toBeDefined());

		assignConvoy();

		// `trigger` delivers synchronously and Vue repaints on a microtask, so one
		// macrotask later every repaint the trigger could cause has happened. The
		// absence of one is the finding, which is why it is waited for at all.
		await new Promise((settle) => setTimeout(settle, 50));
		expect(vue.getByText("AT-101 Survey the north ridge")).toBeDefined();
		expect(vue.queryByText("AT-101 Escort the relay convoy")).toBeNull();
	});
});
