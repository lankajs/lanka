import type { IMicroFrontendBuild } from "./IMicroFrontendBuild";

/**
 * The pipelines of the page's teams, and what each one builds.
 *
 * ## The matrix, and why it is this one
 *
 * Every framework goes through every bundler, every bundler builds more than
 * one framework, and each bundler produces both a module that SHARES the page's
 * lanka and one that CARRIES its own — so no claim rests on one bundler's
 * habits:
 *
 * | Module  | Vite                        | webpack             | Rspack               |
 * | ------- | --------------------------- | ------------------- | -------------------- |
 * | React   | shares                      | shares; relay       | relay; accident      |
 * | Vue     | shares; accident; relay     | shares              | shares               |
 * | Svelte  | shares                      | shares; accident    | shares               |
 * | Angular | relay                       | shares              | shares               |
 *
 * "shares" is built with `lanka` external; "relay" carries its own lanka on
 * purpose and joins the page through `@lankajs/plugin-relay`; "accident" carries
 * its own lanka by mistake, which core warns about.
 *
 * Rspack is the one whose `@lanka_di` comes from `@lankajs/tool-di`'s webpack
 * plugin rather than the test kit's alias — see `buildWithRspack`.
 *
 * `microFrontendPipelines.test.ts` holds it to that: every bundle built here is
 * loaded by a scene, and every framework is built by every bundler.
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
	{
		bundler: "rspack",
		sharing: "one-lanka",
		modules: [
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
		bundler: "rspack",
		sharing: "own-lanka",
		modules: [
			{
				entry: "src/Modules/MissionsReactModule/mountReactIsolated.ts",
				name: "react-isolated",
			},
			{
				entry: "src/Modules/MissionsReactModule/mountMissionsReact.tsx",
				name: "missions-react",
			},
		],
	},
];
