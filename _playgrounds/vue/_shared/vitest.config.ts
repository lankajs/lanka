import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";
import { lankaDiAlias } from "../../../tools/testing/src/vitest";

/**
 * The Vue ecosystem's own suite.
 *
 * Everything here is shared by the applications of one framework, so a failure
 * here is every one of them — which is the argument for testing it once, in the
 * package that owns it.
 *
 * `lankaDiAlias()` substitutes the test kit's `.lanka_di` fixture for an
 * application's barrels: anything importing `lanka` pulls in the scenario
 * bootstrap, which reads `@lanka_di/Scenarios`.
 *
 * A RATCHET, not a target: add the missing test, never lower a number.
 */
export default defineConfig({
	plugins: [vue()],
	resolve: { alias: lankaDiAlias() },
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: ["../../../tools/testing/src/setupTests.ts"],
		alias: lankaDiAlias(),
		include: ["src/**/*.test.ts"],
		/*
		 * A RATCHET, not a target: add the missing test, never lower a number.
		 *
		 * Measured twice, identically: 100 / 100 / 100 / 100 (statements / branches /
		 * functions / lines), and written down as the floor minus one — two runs of an
		 * unchanged suite differ in the hundredths, and a threshold nailed to the best
		 * observation fails on a coin toss.
		 */
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
