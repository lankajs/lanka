import { defineConfig } from "vitest/config";
import { lankaDiAlias } from "../../tools/testing/src/vitest";

/**
 * The suites for modules that were built separately, by two bundlers.
 *
 * `globalSetup` runs every team's pipeline — Vite and webpack — before any
 * test, and the suites then load the BUNDLES, not the source, onto one page.
 * The bundles land under `dist/`, inside this application, and that location
 * is part of the claim: from here vitest resolves a bundle's bare `lanka`
 * import through the same resolver as the shell's own, so an external `lanka`
 * is one module instance. A bundle outside the project would be handed to
 * node's loader, and the page would get a second copy the build never made.
 *
 * ## Svelte is inlined, with the browser condition
 *
 * The page is a browser, and the bundles import `svelte` as a bare specifier
 * the page provides. Left to node, that resolves to Svelte's SERVER build,
 * where `mount` does not exist; inlined, it goes through the `browser`
 * condition the way a real page's import map would point it.
 */
export default defineConfig({
	resolve: { alias: lankaDiAlias(), conditions: ["browser", "development"] },
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: ["../../tools/testing/src/setupTests.ts"],
		globalSetup: ["./vitest.globalSetup.ts"],
		testTimeout: 30000,
		include: ["src/**/*.test.ts"],
		server: { deps: { inline: [/[\\/]svelte[\\/]/] } },
	},
});
