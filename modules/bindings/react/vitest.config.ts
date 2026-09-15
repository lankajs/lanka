import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { lankaDiAlias } from "../../../tools/testing/src/vitest";

/**
 * A binding renders, so every file here needs a DOM.
 *
 * No two-project split, unlike core: core is mostly framework-free and building
 * a jsdom per file is its biggest line item, while this package is a hook and a
 * render helper and nothing in it can be measured without one.
 */
export default defineConfig({
	plugins: [react()],
	resolve: { alias: lankaDiAlias() },
	test: {
		/*
		 * Measured twice, identically: 100 / 92.85 / 100 / 100
		 * (statements / branches / functions / lines).
		 *
		 * The threshold is the lower of two runs minus one, and it only tightens.
		 * The uncovered branches are `useLankaVM`'s two `??` fallbacks — a tracker
		 * that is null, and a ViewModel read before one exists. Neither is
		 * reachable from a mounted component, because the ref is filled on the
		 * first render before anything can read it; they are there because a
		 * nullable ref is the only way React lets a hook build something lazily.
		 */
		coverage: {
			provider: "v8",
			include: ["src/**/*.{ts,tsx}"],
			exclude: [
				"src/**/*.{test,spec}.{ts,tsx}",
				"src/**/*.bench.{ts,tsx}",
				// Declarations only, by rule 10 of the structure canon. A file that
				// compiles to nothing is reported as 0% and drags the number that
				// gates real code.
				"src/**/_types/**",
				"src/**/_interfaces/**",
			],
			thresholds: {
				statements: 90,
				branches: 80,
				functions: 90,
				lines: 90,
			},
		},
		globals: true,
		environment: "jsdom",
		setupFiles: ["@lankajs/tool-testing/setupTests"],
		testTimeout: 30000,
		include: ["src/**/*.test.{ts,tsx}", "_playground/**/*.test.{ts,tsx}"],
		benchmark: { include: ["src/**/*.bench.tsx"] },
	},
});
