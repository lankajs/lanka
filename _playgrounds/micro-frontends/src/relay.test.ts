import { afterAll, afterEach, describe, it, vi } from "vitest";
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

/**
 * Applications that each run THEIR OWN lanka, joined by a relay — mixed with
 * modules that share the shell's.
 *
 * The arrangement for applications that cannot share one copy: another version
 * of the framework, another team's pipeline, isolation by decision. Each such
 * bundle carries and starts its own lanka and installs `@lankajs/plugin-relay`
 * on the page's channel; the shell does the same for the modules that share
 * its copy. Nothing else connects them.
 *
 * Every scene mixes bundlers, and the main one mixes everything at once.
 */

let shell: ILankaInstance | null = null;
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

describe("applications with their own lanka, joined by a relay", () => {
	it("carries the shell's scenario into Vue and Angular, each built by Vite with its own lanka", async () => {
		shell = await startShell();
		// Two copies of lanka on purpose — the case the development warning allows for.
		vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const { mountVueIsolated } = await loadBundle("vite", "own-lanka", "vue-isolated");
		const { mountAngularIsolated } = await loadBundle("vite", "own-lanka", "angular-isolated");

		unmounts.push(await mountVueIsolated!(region(), FROM_THE_SHELL));
		unmounts.push(await mountAngularIsolated!(region(), FROM_THE_SHELL));
		await showsIn("Missions in Vue", SURVEY);
		await showsIn("Missions in Angular", SURVEY);

		shell.activate();
		assignConvoyFromTheShell();

		await showsIn("Missions in Vue", CONVOY);
		await showsIn("Missions in Angular", CONVOY);
	});

	it("repaints the whole page from one click in a webpack-built React app with its own lanka", async () => {
		// Everything at once. The click is in React, built by webpack, running its
		// own lanka. Angular — built by Vite, its own lanka too — hears it from
		// React's relay directly; Svelte (webpack) and Vue (Vite) share the SHELL's
		// lanka and hear it because the shell's relay put it on the shell's bus.
		// Four frameworks, two bundlers, three copies of lanka, one fact.
		shell = await startShell();
		vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const { mountReactIsolated } = await loadBundle("webpack", "own-lanka", "react-isolated");
		const { mountAngularIsolated } = await loadBundle("vite", "own-lanka", "angular-isolated");
		const { mountMissionsSvelte } = await loadBundle("webpack", "one-lanka", "missions-svelte");
		const { mountMissionsVue } = await loadBundle("vite", "one-lanka", "missions-vue");

		shell.activate();
		unmounts.push(
			await mountMissionsSvelte!(region(), {
				missions: FROM_THE_SHELL,
				scope: shell.createScope(),
			}),
		);
		unmounts.push(
			await mountMissionsVue!(region(), {
				missions: FROM_THE_SHELL,
				scope: shell.createScope(),
			}),
		);
		unmounts.push(await mountReactIsolated!(region(), FROM_THE_SHELL));
		unmounts.push(await mountAngularIsolated!(region(), FROM_THE_SHELL));
		for (const label of PAGE) await showsIn(label, SURVEY);

		fireEvent.click(await screen.findByRole("button", { name: "Assign the convoy" }));

		for (const label of PAGE) await showsIn(label, CONVOY);
	});

	it("carries one click in a Rspack-built React app with its own lanka to all three bundlers' modules", async () => {
		// The same page as the scene above, with every module moved to another
		// bundler: React from Rspack and Vue from Vite, each with its own lanka;
		// Angular from Rspack and Svelte from webpack, sharing the shell's. Rspack's
		// React bundle is also the one whose `@lanka_di` came from tool-di's webpack
		// plugin — the lanka it carries was wired by the plugin a consumer uses.
		shell = await startShell();
		vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const { mountReactIsolated } = await loadBundle("rspack", "own-lanka", "react-isolated");
		const { mountVueIsolated } = await loadBundle("vite", "own-lanka", "vue-isolated");
		const { mountMissionsAngular } = await loadBundle(
			"rspack",
			"one-lanka",
			"missions-angular",
		);
		const { mountMissionsSvelte } = await loadBundle("webpack", "one-lanka", "missions-svelte");

		shell.activate();
		for (const mount of [mountMissionsAngular, mountMissionsSvelte]) {
			unmounts.push(
				await mount!(region(), { missions: FROM_THE_SHELL, scope: shell.createScope() }),
			);
		}
		unmounts.push(await mountReactIsolated!(region(), FROM_THE_SHELL));
		unmounts.push(await mountVueIsolated!(region(), FROM_THE_SHELL));
		for (const label of PAGE) await showsIn(label, SURVEY);

		fireEvent.click(await screen.findByRole("button", { name: "Assign the convoy" }));

		for (const label of PAGE) await showsIn(label, CONVOY);
	});

	it("shows the convoy in an application that loads after the one that assigned it has left", async () => {
		// State across copies is the last fact about it, and it outlives whoever
		// announced it: the React app assigns and leaves; the shell retained the
		// fact; an Angular app that arrives afterwards is handed it at once.
		shell = await startShell();
		vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const { mountReactIsolated } = await loadBundle("webpack", "own-lanka", "react-isolated");
		const { mountAngularIsolated } = await loadBundle("vite", "own-lanka", "angular-isolated");

		const leaveReact = await mountReactIsolated!(region(), FROM_THE_SHELL);
		await showsIn("Missions in React", SURVEY);
		fireEvent.click(await screen.findByRole("button", { name: "Assign the convoy" }));
		await showsIn("Missions in React", CONVOY);
		leaveReact();

		unmounts.push(await mountAngularIsolated!(region(), FROM_THE_SHELL));

		await showsIn("Missions in Angular", CONVOY);
	});
});

/** Every list on the main scene's page, by the labels their frameworks gave them. */
const PAGE = ["Missions in React", "Missions in Angular", "Missions in Svelte", "Missions in Vue"];
