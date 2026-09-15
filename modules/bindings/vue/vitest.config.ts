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
		 * Measured twice, identically: 100 / 88.88 / 100 / 100
		 * (statements / branches / functions / lines).
		 *
		 * The threshold is the lower of two runs minus one, and it only tightens.
		 * The uncovered branch is the `getCurrentScope()` arm taken OUTSIDE a
		 * component — reachable, and reached by the conformance suite, which mounts
		 * without one on purpose.
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
				statements: 85,
				branches: 80,
				functions: 85,
				lines: 85,
			},
		},
		globals: true,
		environment: "jsdom",
		setupFiles: ["@lankajs/tool-testing/setupTests"],
		testTimeout: 30000,
		include: ["src/**/*.test.ts", "_playground/**/*.test.ts"],
	},
});
