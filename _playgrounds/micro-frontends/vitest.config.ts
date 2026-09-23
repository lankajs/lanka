import { defineConfig } from "vitest/config";
import { lankaDiAlias } from "../../tools/testing/src/vitest";

/**
 * The suite for modules that were built separately.
 *
 * `globalSetup` runs a real `vite build` per module before any test, and the
 * suite then loads the BUNDLES — not the source — onto one page. The bundles
 * land under `dist/`, inside this application, and that location is part of the
 * claim: from here vitest resolves a bundle's bare `lanka` import through the
 * same resolver as the shell's own, so an external `lanka` is one module
 * instance. A bundle outside the project would be handed to node's loader, and
 * the page would get a second copy the build never made.
 */
export default defineConfig({
	resolve: { alias: lankaDiAlias() },
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: ["../../tools/testing/src/setupTests.ts"],
		globalSetup: ["./vitest.globalSetup.ts"],
		testTimeout: 30000,
		include: ["src/**/*.test.ts"],
	},
});
