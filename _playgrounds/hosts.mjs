/**
 * The applications under `_playgrounds/`, and the contract each one answers to.
 *
 * A separate file from `scripts/registry.mjs` because these are not packages:
 * nothing here is published, nothing has an entry in the registry, and every
 * manifest is `private`. What they have instead is a CONTRACT — SPA, HOST or
 * ISLANDS — and `scripts/check-playgrounds.mjs` holds each one to the scene
 * list its contract names in `_playgrounds/_shared/src/atlasScenes.ts`.
 *
 * `ecosystem` is the binding an application is built on, and `null` for the
 * ones that are built on none. That field is what makes the shelf ratchet
 * possible: a binding with no ecosystem folder is a binding nobody proved under
 * an application.
 */

/** @typedef {"SPA" | "HOST" | "ISLANDS" | "NONE"} TAtlasContract */

/**
 * @typedef {object} IAtlasPlayground
 * @property {string} dir Path from the repository root.
 * @property {TAtlasContract} contract Which scene list this application answers to.
 * @property {string | null} ecosystem The binding it is built on, or null.
 * @property {string[]} suites Suite files, relative to `dir`, that the scenes must appear in.
 * @property {string} [why] Why a `NONE` application exists, since no scene list explains it.
 */

/** @type {IAtlasPlayground[]} */
export const PLAYGROUNDS = [
	{
		dir: "_playgrounds/react/spa",
		contract: "SPA",
		ecosystem: "react",
		suites: ["src/Modules/AtlasMissionsModule/AtlasMissionsScreen.test.tsx"],
	},
	{
		dir: "_playgrounds/react/next",
		contract: "HOST",
		ecosystem: "react",
		// Two files, because this application split the request call and the static
		// call into two units the day it found they were different things. A suite
		// list is per APPLICATION, not per file, for exactly that reason.
		suites: [
			"src/Core/Server/readAtlasMissions.test.ts",
			"src/Core/Server/prerenderAtlasMissions.test.ts",
		],
	},
	{
		dir: "_playgrounds/vue/spa",
		contract: "SPA",
		ecosystem: "vue",
		suites: ["src/atlas-vue.test.ts"],
	},
	{
		dir: "_playgrounds/vue/nuxt",
		contract: "HOST",
		ecosystem: "vue",
		suites: ["src/Core/Server/readAtlasMissions.test.ts"],
	},
	{
		dir: "_playgrounds/svelte/spa",
		contract: "SPA",
		ecosystem: "svelte",
		suites: ["src/atlas-svelte.test.ts"],
	},
	{
		dir: "_playgrounds/svelte/sveltekit",
		contract: "HOST",
		ecosystem: "svelte",
		suites: ["src/Core/Server/readAtlasMissions.test.ts"],
	},
	{
		dir: "_playgrounds/solid/spa",
		contract: "SPA",
		ecosystem: "solid",
		suites: ["src/atlas-solid.test.tsx"],
	},
	{
		dir: "_playgrounds/angular/spa",
		contract: "SPA",
		ecosystem: "angular",
		suites: ["src/atlas-angular.test.ts"],
	},
	{
		/*
		 * The one application that is BOTH, and the reason it is one directory.
		 * Angular's server render is a second call against the same component
		 * tree rather than a second project, so its SPA scenes and its HOST
		 * scenes live side by side.
		 */
		dir: "_playgrounds/angular/spa",
		contract: "HOST",
		ecosystem: "angular",
		suites: ["src/Core/Server/renderAtlasPage.test.ts"],
	},
	{
		dir: "_playgrounds/astro",
		contract: "ISLANDS",
		ecosystem: null,
		suites: [
			"src/Modules/AtlasBoardModule/AtlasBoardIsland.test.tsx",
			"src/Modules/AtlasBoardModule/AtlasBoardIslandVue.test.ts",
			"src/Modules/AtlasBoardModule/AtlasBoardIslandSvelte.test.ts",
			"src/Modules/AtlasBoardModule/AtlasBoardIslandSolid.test.tsx",
		],
	},
	{
		dir: "_playgrounds/vanilla",
		contract: "NONE",
		ecosystem: null,
		suites: [],
		why: "The DOM by hand, from `getState` and `subscribe`. It answers to no scene list because it has no binding to hold to one — what it proves is that the port is enough without any.",
	},
	{
		dir: "_playgrounds/node",
		contract: "NONE",
		ecosystem: null,
		suites: [],
		why: "A service with no DOM. Same argument as vanilla, one layer further out: no screen at all, so no screen scene applies.",
	},
	{
		dir: "_playgrounds/react/native",
		contract: "NONE",
		ecosystem: "react",
		suites: [],
		why: "Expo, where there is no `<input>` and no document. The SPA scenes name DOM roles, so this application proves the same claims through React Native's own testing library under names of its own.",
	},
];

/** Every ecosystem that has at least one application here. */
export const PLAYGROUND_ECOSYSTEMS = [
	...new Set(PLAYGROUNDS.map((one) => one.ecosystem).filter((one) => one !== null)),
];
