import { defineConfig } from "vitest/config";
import { lankaDiAlias } from "../../tools/testing/src/vitest";

/**
 * Atlas's own suite.
 *
 * `lankaDiAlias()` is here for the reason it is in every config in this
 * repository: anything importing `lanka` pulls in the scenario bootstrap, which
 * reads `@lanka_di/Scenarios` — so the alias is needed even though nothing in
 * this package renders.
 *
 * The environment is jsdom rather than node because a ViewModel is a React hook.
 * That is the one thing in this package that is not portable, and it is stated
 * here rather than discovered when a test imports one.
 *
 * Measured twice: 97.83 / 94.55 / 94.91 / 97.83 (statements / branches /
 * functions / lines). The thresholds are the measurement minus one — two runs of
 * an unchanged suite differ in the hundredths, and a threshold nailed to the
 * best observation fails on a coin toss. The rule is the repository's: add the
 * missing test, never lower a threshold.
 */
export default defineConfig({
	resolve: { alias: lankaDiAlias() },
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: ["../../tools/testing/src/setupTests.ts"],
		alias: lankaDiAlias(),
		include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
		coverage: {
			provider: "v8",
			include: ["src/**/*.ts"],
			exclude: ["src/**/*.test.ts", "src/**/_interfaces/**", "src/**/_types/**"],
			thresholds: {
				statements: 96,
				branches: 93,
				functions: 94,
				lines: 96,
			},
		},
	},
});
