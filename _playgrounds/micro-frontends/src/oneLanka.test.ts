import { afterAll, afterEach, describe, expect, it } from "vitest";
import { fireEvent, screen } from "@testing-library/dom";
import { resetActiveLanka } from "lanka/bootstrap";
import {
	CONVOY,
	FROM_THE_SHELL,
	SURVEY,
	assignConvoyFromTheShell,
	loadBundle,
	region,
	showsIn,
	startShell,
} from "./_Testing/pageUnderTest";
import type { ILankaInstance } from "lanka/bootstrap";
import type { TMissionsMount } from "./Core/Mount/TMissionsMount";

/**
 * Modules built by DIFFERENT bundlers, in four frameworks, over the shell's one
 * lanka.
 *
 * Every bundle here was built with `lanka` external, by Vite, webpack or
 * Rspack, and carries its own copy of everything else — the ViewModel
 * definition, the binding, the scenario definitions. One copy of the framework
 * on the page is one bus, and that is the whole requirement: `ARCHITECTURE.md`,
 * "Several frameworks in one application", says why.
 *
 * Each scene draws its modules from more than one bundler, so no claim rests on
 * one bundler's output.
 */

let shell: ILankaInstance | null = null;
const unmounts: (() => void)[] = [];

/** Mounts a module in its own region, in a scope the shell owns. */
const mountIn = async (mount: TMissionsMount | undefined, lanka: ILankaInstance) => {
	const scope = lanka.createScope();
	const unmount = await mount!(region(), { missions: FROM_THE_SHELL, scope });
	unmounts.push(unmount);
	return { scope, unmount };
};

afterEach(() => {
	for (const unmount of unmounts.splice(0)) unmount();
	document.body.innerHTML = "";
	shell?.dispose();
	shell = null;
});

afterAll(() => {
	resetActiveLanka();
});

describe("modules from Vite, webpack and Rspack, over one lanka", () => {
	it("carries the shell's scenario into React and Angular from webpack, and Vue and Svelte from Vite", async () => {
		shell = await startShell();
		const react = await loadBundle("webpack", "one-lanka", "missions-react");
		const angular = await loadBundle("webpack", "one-lanka", "missions-angular");
		const vue = await loadBundle("vite", "one-lanka", "missions-vue");
		const svelte = await loadBundle("vite", "one-lanka", "missions-svelte");

		await mountIn(react.mountMissionsReact, shell);
		await mountIn(angular.mountMissionsAngular, shell);
		await mountIn(vue.mountMissionsVue, shell);
		await mountIn(svelte.mountMissionsSvelte, shell);

		for (const label of FRAMEWORK_LISTS) await showsIn(label, SURVEY);

		assignConvoyFromTheShell();

		for (const label of FRAMEWORK_LISTS) await showsIn(label, CONVOY);
	});

	it("repaints the other three when one module acts", async () => {
		// The write starts INSIDE a module this time — the React module's button,
		// through its own ViewModel's action — and the three others were built by
		// the other bundler, or by the same one for another framework.
		shell = await startShell();
		const react = await loadBundle("webpack", "one-lanka", "missions-react");
		const angular = await loadBundle("webpack", "one-lanka", "missions-angular");
		const vue = await loadBundle("vite", "one-lanka", "missions-vue");
		const svelte = await loadBundle("webpack", "one-lanka", "missions-svelte");

		await mountIn(react.mountMissionsReact, shell);
		await mountIn(angular.mountMissionsAngular, shell);
		await mountIn(vue.mountMissionsVue, shell);
		await mountIn(svelte.mountMissionsSvelte, shell);
		await showsIn("Missions in Angular", SURVEY);

		fireEvent.click(await screen.findByRole("button", { name: "Assign the convoy" }));

		for (const label of FRAMEWORK_LISTS) await showsIn(label, CONVOY);
	});

	it("repaints Vue, Svelte and Angular from Rspack when React from Vite acts", async () => {
		// The third bundler. Rspack takes webpack's configuration, but it is another
		// engine emitting another module graph, and "webpack-compatible" is a claim
		// about the first, not the second: what has to hold is that its bundles
		// import the page's lanka rather than carrying one, and meet it on one bus.
		shell = await startShell();
		const react = await loadBundle("vite", "one-lanka", "missions-react");
		const vue = await loadBundle("rspack", "one-lanka", "missions-vue");
		const svelte = await loadBundle("rspack", "one-lanka", "missions-svelte");
		const angular = await loadBundle("rspack", "one-lanka", "missions-angular");

		await mountIn(react.mountMissionsReact, shell);
		await mountIn(vue.mountMissionsVue, shell);
		await mountIn(svelte.mountMissionsSvelte, shell);
		await mountIn(angular.mountMissionsAngular, shell);
		for (const label of FRAMEWORK_LISTS) await showsIn(label, SURVEY);

		fireEvent.click(await screen.findByRole("button", { name: "Assign the convoy" }));

		for (const label of FRAMEWORK_LISTS) await showsIn(label, CONVOY);
	});

	it("takes every module's ViewModels off the bus when the shell closes its scopes", async () => {
		// A module that leaves must stop running handlers against a screen that is
		// gone, whoever built it. The shell owns each scope; no module remembers
		// anything.
		shell = await startShell();
		const before = shell.viewModels.getAllViewModels().length;
		const mounted = [
			await mountIn(
				(await loadBundle("vite", "one-lanka", "missions-react")).mountMissionsReact,
				shell,
			),
			await mountIn(
				(await loadBundle("webpack", "one-lanka", "missions-vue")).mountMissionsVue,
				shell,
			),
			await mountIn(
				(await loadBundle("vite", "one-lanka", "missions-svelte")).mountMissionsSvelte,
				shell,
			),
			await mountIn(
				(await loadBundle("webpack", "one-lanka", "missions-angular")).mountMissionsAngular,
				shell,
			),
		];
		// Each of the four rendered — React from Vite and Vue from webpack are
		// asserted HERE and nowhere else, so this line is their coverage.
		for (const label of FRAMEWORK_LISTS) await showsIn(label, SURVEY);

		// Four missions ViewModels, and React's assignment one has no scenario
		// handlers, so it never registers.
		expect(shell.viewModels.getAllViewModels().length).toBe(before + 4);

		for (const { scope, unmount } of mounted) {
			unmount();
			scope.dispose();
		}
		unmounts.length = 0;

		expect(shell.viewModels.getAllViewModels().length).toBe(before);
	});
});

/** The four lists, by the labels their frameworks gave them. */
const FRAMEWORK_LISTS = [
	"Missions in React",
	"Missions in Angular",
	"Missions in Vue",
	"Missions in Svelte",
];
