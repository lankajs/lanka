import { defineConfig } from "vitest/config";
import { lankaDiAlias } from "../../tools/testing/src/vitest";

/**
 * The framework-free application's suite.
 *
 * No UI plugin, because there is no UI framework. `lankaDiAlias()` substitutes
 * the test kit's `.lanka_di` fixture for this application's own barrels — needed
 * even here, because anything importing `lanka` pulls in the scenario bootstrap,
 * which reads `@lanka_di/Scenarios`.
 *
 * Two suites, two environments, and the split is the whole point. The unit file
 * runs under jsdom and reaches no network; `atlas-vanilla.live.test.ts` declares
 * `@vitest-environment node` and installs a document by hand, because node's
 * fetch refuses a signal built in jsdom's realm and this application both paints
 * AND talks to a server.
 *
 * Measured twice, identically: 100 / 90.9 / 100 / 100 (statements / branches /
 * functions / lines). The thresholds are the measurement minus one: two runs of
 * an unchanged suite differ in the hundredths, and a number nailed to the best
 * observation fails on a coin toss. Add the missing test, never lower a
 * threshold.
 *
 * The two uncovered branches are the `connect` default and the `?? "signed out"`
 * fallback — the arms a suite reaches only by starting a stream it then has to
 * close, and by signing in as nobody.
 */
export default defineConfig({
	resolve: { alias: lankaDiAlias() },
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: ["../../tools/testing/src/setupTests.ts"],
		testTimeout: 30000,
		include: ["src/**/*.test.ts"],
		coverage: {
			provider: "v8",
			include: ["src/**/*.ts"],
			exclude: ["src/**/*.test.ts", "src/main.ts", "src/env.d.ts"],
			thresholds: { statements: 99, branches: 89, functions: 99, lines: 99 },
		},
	},
});
