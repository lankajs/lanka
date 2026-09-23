import { AtlasMissionGateway, createAtlasMissionsVM } from "@lanka-playgrounds/_shared";
import { mount, unmount } from "svelte";
import { defineLankaVM, resolveLankaVM } from "lanka/extend";
import { hydrateLankaVM } from "@lankajs/host";
import MissionsSvelte from "./MissionsSvelte.svelte";
import type { TMissionsMount } from "../../Core/Mount/TMissionsMount";

/** This module's own ViewModel, as a definition — the same reasoning as the React module's. */
const missions = defineLankaVM({
	name: "MissionsSvelteVM",
	build: () => createAtlasMissionsVM(new AtlasMissionGateway()),
});

/**
 * What the shell calls — the same contract as every other module.
 *
 * A compiled component, which is the one thing about this module a bundler
 * must be told: Vite through its Svelte plugin, webpack through `svelte-loader`.
 * The same source goes through both.
 */
export const mountMissionsSvelte: TMissionsMount = (element, { missions: rows, scope }) => {
	const viewModel = resolveLankaVM(missions, { scope });
	hydrateLankaVM(viewModel, { missions: rows });

	const component = mount(MissionsSvelte, { target: element, props: { viewModel } });

	return () => {
		void unmount(component);
	};
};
