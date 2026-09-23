import { buildMicroFrontend } from "./src/Core/Build/buildMicroFrontend";

/**
 * The modules are BUILT before the suite runs, once, in the main process.
 *
 * Built here rather than by a `build:app` step, because the suite is what
 * `pnpm check` runs and a bundle nobody rebuilt would test yesterday's source.
 * Four bundles: both modules against one lanka, the Vue module once more
 * carrying its own by accident, and the isolated module carrying its own on
 * purpose — with a relay inside it.
 */
export default async function buildTheModules(): Promise<void> {
	await buildMicroFrontend({
		entry: "src/Modules/MissionsReactModule/mountMissionsReact.tsx",
		name: "missions-react",
		sharing: "one-lanka",
	});
	await buildMicroFrontend({
		entry: "src/Modules/MissionsVueModule/mountMissionsVue.ts",
		name: "missions-vue",
		sharing: "one-lanka",
	});
	await buildMicroFrontend({
		entry: "src/Modules/MissionsVueModule/mountMissionsVue.ts",
		name: "missions-vue",
		sharing: "own-lanka",
	});
	await buildMicroFrontend({
		entry: "src/Modules/MissionsIsolatedModule/mountMissionsIsolated.ts",
		name: "missions-isolated",
		sharing: "own-lanka",
	});
}
