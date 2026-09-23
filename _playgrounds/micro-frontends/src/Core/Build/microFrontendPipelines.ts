import type { IMicroFrontendBuild } from "./IMicroFrontendBuild";

/**
 * The pipelines of the page's teams, and what each one builds.
 *
 * ## The matrix, and why it is this one
 *
 * Every framework goes through at least one bundler, every bundler builds more
 * than one framework, and each bundler produces both a module that SHARES the
 * page's lanka and one that CARRIES its own — so no claim rests on one
 * bundler's habits:
 *
 * | Module  | Vite                                      | webpack                          |
 * | ------- | ----------------------------------------- | -------------------------------- |
 * | React   | shares                                    | shares; its own, with a relay    |
 * | Vue     | shares; its own by accident; with a relay | shares                           |
 * | Svelte  | shares                                    | shares; its own by accident      |
 * | Angular | its own, with a relay                     | shares                           |
 *
 * `microFrontendPipelines.test.ts` holds it to that: every bundle built here is
 * loaded by a scene, and every framework is built by both bundlers.
 */
export const MICRO_FRONTEND_PIPELINES: readonly IMicroFrontendBuild[] = [
	{
		bundler: "vite",
		sharing: "one-lanka",
		modules: [
			{
				entry: "src/Modules/MissionsReactModule/mountMissionsReact.tsx",
				name: "missions-react",
			},
			{ entry: "src/Modules/MissionsVueModule/mountMissionsVue.ts", name: "missions-vue" },
			{
				entry: "src/Modules/MissionsSvelteModule/mountMissionsSvelte.ts",
				name: "missions-svelte",
			},
		],
	},
	{
		bundler: "vite",
		sharing: "own-lanka",
		modules: [
			{ entry: "src/Modules/MissionsVueModule/mountMissionsVue.ts", name: "missions-vue" },
			{ entry: "src/Modules/MissionsVueModule/mountVueIsolated.ts", name: "vue-isolated" },
			{
				entry: "src/Modules/MissionsAngularModule/mountAngularIsolated.ts",
				name: "angular-isolated",
			},
		],
	},
	{
		bundler: "webpack",
		sharing: "one-lanka",
		modules: [
			{
				entry: "src/Modules/MissionsReactModule/mountMissionsReact.tsx",
				name: "missions-react",
			},
			{ entry: "src/Modules/MissionsVueModule/mountMissionsVue.ts", name: "missions-vue" },
			{
				entry: "src/Modules/MissionsSvelteModule/mountMissionsSvelte.ts",
				name: "missions-svelte",
			},
			{
				entry: "src/Modules/MissionsAngularModule/mountMissionsAngular.ts",
				name: "missions-angular",
			},
		],
	},
	{
		bundler: "webpack",
		sharing: "own-lanka",
		modules: [
			{
				entry: "src/Modules/MissionsReactModule/mountReactIsolated.ts",
				name: "react-isolated",
			},
			{
				entry: "src/Modules/MissionsSvelteModule/mountMissionsSvelte.ts",
				name: "missions-svelte",
			},
		],
	},
];
