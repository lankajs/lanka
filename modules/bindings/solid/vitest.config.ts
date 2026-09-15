import solid from "vite-plugin-solid";
import { defineConfig } from "vitest/config";
import { lankaDiAlias } from "../../../tools/testing/src/vitest";

/**
 * A binding renders, so every file here needs a DOM.
 *
 * The Solid plugin is here because the conformance adapter renders a real
 * component — the same thing React's and Vue's do — and Solid's JSX is compiled
 * rather than interpreted. The package's own `src/` needs none of it: a signal
 * and a subscription are plain TypeScript, which is why this builds with `tsup`
 * like every other package here.
 *
 * `resolve.conditions` names `development`, because Solid ships two builds and
 * the production one omits the ownership graph a test needs to dispose.
 */
export default defineConfig({
	plugins: [solid()],
	resolve: {
		alias: lankaDiAlias(),
		conditions: ["development", "browser"],
	},
	test: {
		/*
		 * Measured twice, identically: 100 / 87.5 / 100 / 100
		 * (statements / branches / functions / lines).
		 *
		 * The threshold is the lower of two runs minus one, and it only tightens.
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
			thresholds: { statements: 85, branches: 80, functions: 85, lines: 85 },
		},
		globals: true,
		environment: "jsdom",
		setupFiles: ["@lankajs/tool-testing/setupTests"],
		testTimeout: 30000,
		include: ["src/**/*.test.{ts,tsx}", "_playground/**/*.test.{ts,tsx}"],
	},
});
