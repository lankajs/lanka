import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { lankaDiAlias } from "../../../tools/testing/src/vitest";

/**
 * The browser application's suite.
 *
 * `lankaDiAlias()` substitutes the test kit's `.lanka_di` fixture for this
 * application's own barrels. It is needed even in a test that renders nothing:
 * anything importing `lanka` pulls in the scenario bootstrap, which reads
 * `@lanka_di/Scenarios`.
 *
 * Measured twice: 98.34 / 88.98 / 92.15 / 98.34 (statements / branches /
 * functions / lines). The thresholds are the measurement minus one — two runs of
 * an unchanged suite differ in the hundredths, and a threshold nailed to the
 * best observation fails on a coin toss. The rule is the repository's: add the
 * missing test, never lower a threshold.
 */
export default defineConfig({
	plugins: [react()],
	resolve: { alias: lankaDiAlias() },
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: ["../../../tools/testing/src/setupTests.ts"],
		alias: lankaDiAlias(),
		include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
		coverage: {
			provider: "v8",
			include: ["src/**/*.ts", "src/**/*.tsx"],
			exclude: [
				"src/**/*.test.ts",
				"src/**/*.test.tsx",
				// The executable entry: it reads the environment, starts the
				// application and mounts it. Covering it would mean mounting the real
				// application at a real API from a unit run.
				"src/main.tsx",
			],
			thresholds: {
				statements: 97,
				branches: 87,
				functions: 91,
				lines: 97,
			},
		},
	},
});
