import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";

/**
 * The Kit application's suite.
 *
 * Kit's own plugin is NOT here, and the omission is the point: `sveltekit()`
 * builds a server and a client bundle and owns the module graph, which a test
 * runner then cannot enter. What this suite asserts is the two halves either
 * side of Kit — a component, and the server functions the routes call — so it
 * needs the compiler and nothing else. Nothing here renders `+page.svelte`, which
 * would be testing Kit's own data loading, and this repository does not ship it.
 *
 * The `@lanka_di` alias points at THIS application's own barrels rather than at
 * the test kit's fixture, for the reason the Next and Nuxt applications state:
 * the server half resolves gateways BY NAME, so a fixture with empty barrels
 * would turn every such test into a named refusal. Pointing at the real ones
 * makes the barrels part of what is tested.
 *
 * `resolve.conditions` names `browser`: Svelte's default export condition in
 * node is its SERVER build, where effects do not run at all, and a suite that
 * silently got that one would assert nothing.
 *
 * A RATCHET, not a target: add the missing test, never lower a number. Measured
 * twice, identically: 100 / 100 / 100 / 100 (statements / branches / functions /
 * lines), written down as the floor minus one — two runs of an unchanged suite
 * differ in the hundredths, and a threshold nailed to the best observation fails
 * on a coin toss.
 */
const barrels = fileURLToPath(new URL("./.lanka", import.meta.url));

export default defineConfig({
	plugins: [svelte({ hot: false })],
	resolve: { alias: { "@lanka_di": barrels }, conditions: ["browser", "development"] },
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: ["../../../tools/testing/src/setupTests.ts"],
		alias: { "@lanka_di": barrels },
		include: ["src/**/*.test.ts"],
		coverage: {
			provider: "v8",
			include: ["src/**/*.ts", "src/**/*.svelte"],
			exclude: ["src/**/*.test.ts", "src/**/*.d.ts", "src/routes/**"],
			thresholds: { statements: 99, branches: 99, functions: 99, lines: 99 },
		},
	},
});
