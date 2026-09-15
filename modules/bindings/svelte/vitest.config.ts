import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";
import { lankaDiAlias } from "../../../tools/testing/src/vitest";

/**
 * A binding renders, so every file here needs a DOM.
 *
 * The Svelte plugin is here for ONE reason: `$effect` is a compiler rune, not a
 * runtime export, so an adapter that drives the reactive graph has to live in a
 * `.svelte.ts` module and be compiled. The package's own `src/` needs none of
 * that — `createSubscriber` is plain TypeScript — which is why this package
 * builds with `tsup` like every other one here.
 *
 * `resolve.conditions` names `browser`: Svelte's default export condition in
 * node is its SERVER build, where effects do not run at all, and a suite that
 * silently got that one would assert nothing.
 */
export default defineConfig({
	plugins: [svelte({ hot: false })],
	resolve: {
		alias: lankaDiAlias(),
		conditions: ["browser", "development"],
	},
	test: {
		/*
		 * A RATCHET, not a target: add the missing test, never lower a number.
		 *
		 * Measured twice, identically: 100 / 96.29 / 100 / 100
		 * (statements / branches / functions / lines), and written down as the floor
		 * minus one — two runs of an unchanged suite differ in the hundredths, and a
		 * threshold nailed to the best observation fails on a coin toss.
		 *
		 * The uncovered branches are the selector arm and the teardown a subscriber outside a component takes.
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
