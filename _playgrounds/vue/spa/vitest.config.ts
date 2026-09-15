import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";
import { lankaDiAlias } from "../../../tools/testing/src/vitest";

/**
 * The Vue application's suite.
 *
 * `lankaDiAlias()` substitutes the test kit's `.lanka_di` fixture for this
 * application's own barrels. It is needed even in a test that renders nothing:
 * anything importing `lanka` pulls in the scenario bootstrap, which reads
 * `@lanka_di/Scenarios`.
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
			include: ["src/**/*.ts", "src/**/*.vue"],
			exclude: [
				"src/**/*.test.ts",
				// The executable entry: it reads the environment, starts the
				// application and mounts it. Covering it would mean mounting the real
				// application at a real API from a unit run.
				"src/main.ts",
				// Declarations only, by rule 10 of the structure canon. A file that
				// compiles to nothing is reported as 0% and drags the number that gates
				// real code.
				"src/**/*.d.ts",
			],
			thresholds: {
				statements: 99,
				branches: 99,
				functions: 99,
				lines: 99,
			},
		},
	},
});
