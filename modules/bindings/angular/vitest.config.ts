import { defineConfig } from "vitest/config";
import { lankaDiAlias } from "../../../tools/testing/src/vitest";

/**
 * A binding renders, so every file here needs a DOM.
 *
 * No Angular compiler plugin: the conformance adapter drives SIGNALS and an
 * injector, which are plain runtime APIs. A component with a template would need
 * `TestBed` and the whole module compiler, and what it would add is Angular's
 * rendering rather than this binding — `_playgrounds/angular` is where a real
 * component reading a ViewModel is proved.
 */
export default defineConfig({
	resolve: { alias: lankaDiAlias() },
	test: {
		/*
		 * A RATCHET, not a target: add the missing test, never lower a number.
		 *
		 * Measured twice, identically: 100 / 87.5 / 100 / 100
		 * (statements / branches / functions / lines), and written down as the floor
		 * minus one — two runs of an unchanged suite differ in the hundredths, and a
		 * threshold nailed to the best observation fails on a coin toss.
		 *
		 * The uncovered branches are the `??` fallbacks a lazily-built ref needs and
		 * the selector arms a component cannot take both of at once. Neither is
		 * reachable from a mounted reader.
		 */
		coverage: {
			provider: "v8",
			include: ["src/**/*.ts"],
			exclude: [
				"src/**/*.{test,spec}.ts",
				"src/**/*.bench.ts",
				"src/**/_types/**",
				"src/**/_interfaces/**",
			],
			thresholds: { statements: 85, branches: 80, functions: 85, lines: 85 },
		},
		globals: true,
		environment: "jsdom",
		setupFiles: [
			"@lankajs/tool-testing/setupTests",
			"./_playground/_testing/setupAngularTestEnvironment.ts",
		],
		testTimeout: 30000,
		include: ["src/**/*.test.ts", "_playground/**/*.test.ts"],
	},
});
