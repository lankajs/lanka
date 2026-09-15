import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";
import { lankaDiAlias } from "../../../tools/testing/src/vitest";

/**
 * A binding renders, so every file here needs a DOM.
 *
 * No two-project split, unlike core: core is mostly framework-free and building
 * a jsdom per file is its biggest line item, while this package is a composable
 * and a render helper and nothing in it can be measured without one.
 */
export default defineConfig({
	plugins: [vue()],
	resolve: { alias: lankaDiAlias() },
	test: {
		/*
		 * A RATCHET, not a target: add the missing test, never lower a number.
		 *
		 * Measured twice, identically: 100 / 96.29 / 100 / 100
		 * (statements / branches / functions / lines), and written down as the floor
		 * minus one — two runs of an unchanged suite differ in the hundredths, and a
		 * threshold nailed to the best observation fails on a coin toss.
		 *
		 * The uncovered branches are the `stop` a caller outside a component scope keeps, and the selector arm.
		 */
		coverage: {
			provider: "v8",
			include: ["src/**/*.ts"],
			exclude: [
				"src/**/*.{test,spec}.{ts,tsx}",
				"src/**/*.bench.{ts,tsx}",
				"src/**/_types/**",
				"src/**/_interfaces/**",
			],
			thresholds: {
				statements: 99,
				branches: 95,
				functions: 99,
				lines: 99,
			},
		},
		globals: true,
		environment: "jsdom",
		setupFiles: ["@lankajs/tool-testing/setupTests"],
		testTimeout: 30000,
		include: ["src/**/*.test.ts", "_playground/**/*.test.ts"],
	},
});
