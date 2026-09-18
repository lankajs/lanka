import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";
import { lankaDiAlias } from "../../../tools/testing/src/vitest";

/**
 * The Svelte application's suite.
 *
 * `resolve.conditions` names `browser`: Svelte's default export condition in
 * node is its SERVER build, where effects do not run at all, and a suite that
 * silently got that one would assert nothing.
 *
 * A RATCHET, not a target: add the missing test, never lower a number.
 *
 * ## Why branches stop at 88 where every other number is 100
 *
 * v8 counts branches in the code it RUNS, and what runs here is Svelte's
 * compiler output. Three arms in `AtlasMissionsScreen` belong to no `{#if}` in
 * the source — they are the dirty checks the compiler emits around a text
 * interpolation, and two of them sit on the `}` and `{` of
 * `{missions.page} / {missions.rows().totalPages}`. The third is the arm where a
 * row's `code` changes while its key does not, which in this domain is a
 * mission being renumbered without being replaced: nothing does it, and a test
 * that made it happen would be asserting an application that does not exist.
 *
 * Measured twice at 100/88/100/100, so the floor is one below each.
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
			include: ["src/**/*.ts", "src/**/*.svelte"],
			exclude: ["src/**/*.test.ts", "src/main.ts", "src/**/*.d.ts"],
			thresholds: { statements: 99, branches: 87, functions: 99, lines: 99 },
		},
	},
});
