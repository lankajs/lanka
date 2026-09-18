import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import react from "@vitejs/plugin-react";
import vue from "@vitejs/plugin-vue";
import solid from "vite-plugin-solid";
import { defineConfig } from "vitest/config";

/**
 * The Astro application's suite.
 *
 * The `@lanka_di` alias points at THIS application's own barrels rather than at
 * the test kit's fixture: the server half resolves gateways by name, so a
 * fixture with empty barrels would turn every such test into a named refusal —
 * and pointing at the real ones makes the barrels part of what is tested.
 *
 * Nothing here renders a `.astro` file. That would be testing Astro, and the
 * decisions this application makes are ordinary modules under `src/`.
 *
 * ## Four compilers in one config, and the two that need telling apart
 *
 * React and Solid both transform `.tsx`, so each plugin is given an `include`
 * naming the files it owns — `astro.config.mjs` makes the same arrangement for
 * the build, and for the same reason: without it whichever is listed first wins
 * silently, and the loser's component renders nothing while reporting no error.
 *
 * `resolve.conditions` names `development` and `browser` together: Solid's
 * production build omits the ownership graph a test needs to dispose, and
 * Svelte's node condition is its SERVER build, where effects never run.
 *
 * Measured twice: 100 / 95.65 / 100 / 100. The thresholds below are the
 * measurement minus one, and branches TIGHTENED from 84 the day three more
 * islands arrived — a ratchet only moves toward stricter, and three components
 * with no unreached arm in them is what moved it.
 */
const barrels = fileURLToPath(new URL("./.lanka_di", import.meta.url));

export default defineConfig({
	plugins: [
		react({ include: ["**/AtlasBoardIsland.tsx", "**/AtlasBoardIsland.test.tsx"] }),
		solid({
			include: ["**/AtlasBoardIslandSolid.tsx", "**/AtlasBoardIslandSolid.test.tsx"],
		}),
		vue(),
		svelte({ hot: false }),
	],
	resolve: {
		alias: { "@lanka_di": barrels },
		conditions: ["development", "browser"],
	},
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: ["../../tools/testing/src/setupTests.ts"],
		alias: { "@lanka_di": barrels },
		include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
		coverage: {
			provider: "v8",
			include: ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue", "src/**/*.svelte"],
			exclude: ["src/**/*.test.ts", "src/**/*.test.tsx"],
			thresholds: { statements: 99, branches: 94, functions: 99, lines: 99 },
		},
	},
});
