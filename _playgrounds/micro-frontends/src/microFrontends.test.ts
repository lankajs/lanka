import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { atlasMissionAssigned } from "@lanka-playgrounds/_shared";
import { lankaRelay } from "@lankajs/plugin-relay";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { resetActiveLanka, startLanka } from "lanka/bootstrap";
import { screen, waitFor, within } from "@testing-library/dom";
import type { IAtlasMission } from "@lanka-playgrounds/_shared";
import type { ILankaInstance } from "lanka/bootstrap";
import type { IMissionsMount } from "./Core/Mount/IMissionsMount";
import type { TLankaSharing } from "./Core/Build/buildMicroFrontend";

/**
 * Modules in two frameworks, built SEPARATELY, on one page.
 *
 * `vitest.globalSetup.ts` built each module with `vite build` before this file
 * ran, and what is loaded below is the bundle, not the source. The shell is this
 * file: it starts lanka, reserves a region of the page per module, hands each
 * module a scope and closes it when the module leaves — which is all a shell
 * does in a micro-frontend arrangement, whatever loads the bundles in
 * production.
 *
 * ## Two arrangements, and what each needs
 *
 * Modules that share the shell's lanka share its bus: a scenario reaches them
 * with nothing in between. Each bundle still carries its OWN copy of the
 * application — the ViewModel definition, the binding, `atlasMissionAssigned` —
 * and `ARCHITECTURE.md`, "Several frameworks in one application", says why one
 * copy of `lanka` is enough.
 *
 * A module that runs its OWN lanka cannot share that bus, and hears the shell
 * through `@lankajs/plugin-relay` instead.
 */

/** The contracts the modules' entries keep. */
interface IMissionsModule {
	mountMissionsReact?: (element: Element, mount: IMissionsMount) => () => void;
	mountMissionsVue?: (element: Element, mount: IMissionsMount) => () => void;
	mountMissionsIsolated?: (
		element: Element,
		missions: readonly IAtlasMission[],
	) => Promise<() => void>;
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

let shell: ILankaInstance | null = null;

/**
 * The shell's start-up, inside each scene rather than in a `beforeAll`.
 *
 * The test kit's setup puts a fresh, unstarted instance in place before every
 * test, so a framework started once for the file is not the active one by the
 * time a scene runs. Starting here is also the order a page has: the shell
 * starts, THEN the remotes arrive. It joins the page's channel as the SENDER of
 * the one event the isolated module listens for.
 */
const startShell = async (): Promise<ILankaInstance> => {
	shell = await startLanka({
		host: lankaTestHost,
		flags: { isDevelopment: true },
		plugins: [lankaRelay({ channel: "atlas", send: [atlasMissionAssigned.eventType] })],
	});
	return shell;
};

const unmounts: (() => void)[] = [];

afterEach(() => {
	for (const unmount of unmounts.splice(0)) unmount();
	document.body.innerHTML = "";
	shell?.dispose();
	shell = null;
	vi.restoreAllMocks();
});

afterAll(() => {
	resetActiveLanka();
});

describe("modules built separately, over one lanka", () => {
	it("carries a scenario triggered by the shell into both frameworks", async () => {
		// Loaded AFTER the shell started lanka, which is the order a remote arrives
		// in: its ViewModels are created while the framework is already running.
		const lanka = await startShell();
		const { mountMissionsReact } = await loadModule("one-lanka", "missions-react");
		const { mountMissionsVue } = await loadModule("one-lanka", "missions-vue");

		unmounts.push(
			mountMissionsReact!(region(), { missions: FROM_THE_SHELL, scope: lanka.createScope() }),
		);
		unmounts.push(
			mountMissionsVue!(region(), { missions: FROM_THE_SHELL, scope: lanka.createScope() }),
		);

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

	it("takes a module's ViewModels off the bus when the shell closes its scope", async () => {
		// A module that leaves the page must stop running handlers against a screen
		// that is gone. The shell owns the scope; the module remembers nothing.
		const lanka = await startShell();
		const { mountMissionsReact } = await loadModule("one-lanka", "missions-react");
		const before = lanka.viewModels.getAllViewModels().length;

		const scope = lanka.createScope();
		const unmount = mountMissionsReact!(region(), { missions: FROM_THE_SHELL, scope });
		await screen.findByLabelText("Missions in React");

		expect(lanka.viewModels.getAllViewModels().length).toBe(before + 1);

		unmount();
		scope.dispose();

		expect(lanka.viewModels.getAllViewModels().length).toBe(before);
	});
});

describe("a module that runs its own lanka, on purpose", () => {
	it("hears the shell's scenario through the relay", async () => {
		// Its bundle carries a second copy of lanka, which it starts itself — a
		// second bus the shell's scenario cannot reach directly. The relay on each
		// side repeats the one delivery both of them named.
		await startShell();
		vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const { mountMissionsIsolated } = await loadModule("own-lanka", "missions-isolated");

		unmounts.push(await mountMissionsIsolated!(region(), FROM_THE_SHELL));
		const isolated = within(await screen.findByLabelText("Missions, isolated"));
		await waitFor(() =>
			expect(isolated.getByText("AT-101 Survey the north ridge")).toBeDefined(),
		);

		shell!.activate();
		assignConvoy();

		await waitFor(() =>
			expect(isolated.getByText("AT-101 Escort the relay convoy")).toBeDefined(),
		);
	});
});

describe("a module that bundled its own lanka by accident", () => {
	it("is warned about as it loads, and refuses the shell's scope by naming the cause", async () => {
		// The accident, reproduced by a bundler rather than described: the build
		// inlined lanka, and the module never starts it because the shell already
		// did. Loading warns; the first thing it asks its own copy for — an
		// instance to resolve its ViewModel in — says another copy has one.
		const lanka = await startShell();
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

		const { mountMissionsVue } = await loadModule("own-lanka", "missions-vue");

		expect(warn).toHaveBeenCalledWith(expect.stringContaining("two copies of lanka"));
		expect(() =>
			mountMissionsVue!(region(), { missions: FROM_THE_SHELL, scope: lanka.createScope() }),
		).toThrowError(/another copy of lanka/);
	});
});
