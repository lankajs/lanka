import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";
import { lankaDiAlias } from "../../../tools/testing/src/vitest";

/**
 * The Svelte ecosystem's own suite.
 *
 * Everything here is shared by the applications of one framework, so a failure
 * here is every one of them — which is the argument for testing it once, in the
 * package that owns it.
 *
 * `resolve.conditions` names `browser`: Svelte's default export condition in
 * node is its SERVER build, where effects never run and a subscription is never
 * made. A suite that silently got that one would assert nothing and say so in
 * green.
 *
 * A RATCHET, not a target: add the missing test, never lower a number.
 * Measured twice, identically: 100 / 100 / 100 / 100, written down as the floor
 * minus one — two runs of an unchanged suite differ in the hundredths, and a
 * threshold nailed to the best observation fails on a coin toss.
 */
export default defineConfig({
	plugins: [svelte({ hot: false })],
	resolve: { alias: lankaDiAlias(), conditions: ["browser", "development"] },
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: ["../../../tools/testing/src/setupTests.ts"],
		alias: lankaDiAlias(),
		include: ["src/**/*.test.ts"],
		coverage: {
			provider: "v8",
			include: ["src/**/*.ts"],
			exclude: ["src/**/*.test.ts", "src/index.ts"],
			thresholds: {
				statements: 99,
				branches: 99,
				functions: 99,
				lines: 99,
			},
		},
	},
});
