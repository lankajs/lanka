import solid from "vite-plugin-solid";
import { defineConfig } from "vitest/config";
import { lankaDiAlias } from "../../../tools/testing/src/vitest";

/**
 * The Solid application's suite.
 *
 * `resolve.conditions` names `development`, because Solid ships two builds and
 * the production one omits the ownership graph a test needs to dispose — a suite
 * that silently got the other one leaks an owner per scene and reports nothing.
 *
 * A RATCHET, not a target: add the missing test, never lower a number. Measured
 * twice, identically: 100 / 100 / 100 / 100 (statements / branches / functions /
 * lines), written down as the floor minus one — two runs of an unchanged suite
 * differ in the hundredths, and a threshold nailed to the best observation fails
 * on a coin toss.
 */
export default defineConfig({
	plugins: [solid()],
	resolve: { alias: lankaDiAlias(), conditions: ["development", "browser"] },
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: ["../../../tools/testing/src/setupTests.ts"],
		alias: lankaDiAlias(),
		include: ["src/**/*.test.{ts,tsx}"],
		coverage: {
			provider: "v8",
			include: ["src/**/*.{ts,tsx}"],
			exclude: ["src/**/*.test.{ts,tsx}", "src/index.tsx", "src/**/*.d.ts"],
			thresholds: { statements: 99, branches: 99, functions: 99, lines: 99 },
		},
	},
});
