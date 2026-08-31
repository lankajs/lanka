import { defineConfig } from "vitest/config";
import { lankaDiAlias } from "../../tools/testing/src/vitest";

/**
 * Storages talk almost entirely to browser APIs, so the whole package runs
 * under jsdom: of fourteen modules only the id registry does not need the DOM,
 * which does not pay for splitting the package into two projects like core.
 *
 * `setupTests` from `@lankajs/tool-testing` provides the localStorage and
 * sessionStorage stubs and resets timers between tests.
 */
export default defineConfig({
	// Importing `lanka` pulls in LankaScenarioBootstrap, which reads the consumer's
	// barrels. In a real application @lankajs/tool-di sets the alias; under test
	// this call does.
	resolve: { alias: lankaDiAlias() },
	test: {
		/*
		 * Measured twice: 79.24 / 94.27 / 82.40 / 79.24
		 * (statements / branches / functions / lines).
		 *
		 * The threshold is the lower of two runs minus one. Two consecutive runs of
		 * an unchanged suite differ in the hundredths: something on the async paths
		 * takes one branch or the other depending on the scheduler. A threshold
		 * nailed to the best observation is not stricter — it just fails on a coin
		 * toss, and a check that cries wolf stops being read.
		 *
		 * The rule is not negotiable: add the missing tests, NEVER lower a
		 * threshold.
		 */
		coverage: {
			provider: "v8",
			include: ["src/**/*.ts"],
			// ONLY tests are excluded. Excluding barrels is tempting — "nothing to
			// cover in them" — but a package whose code lives in index.ts is then
			// measured as empty: the threshold becomes zero, and a check that cannot
			// fail reports success.
			exclude: [
				"src/**/*.test.ts",
				// Benches run under `vitest bench`, which this run does not perform:
				// counted here they report 0% and drag the number that gates real code.
				"src/**/*.bench.ts",
				"src/**/*.bench.tsx",
				"src/**/*.test.tsx",
				// Declarations only, by rule 10 of the structure canon and checked
				// there. A file that compiles to nothing is reported as 0% and drags
				// the number that gates real code.
				"src/**/_types/**",
				"src/**/_interfaces/**",
			],
			thresholds: {
				statements: 81,
				branches: 92,
				functions: 85,
				lines: 81,
			},
		},
		globals: true,
		environment: "jsdom",
		setupFiles: ["../../tools/testing/src/setupTests.ts"],
		testTimeout: 30000,
		include: ["src/**/*.test.ts", "_playground/**/*.test.ts"],
		/*
		 * Benches live beside what they measure, as tests do.
		 *
		 * Named explicitly rather than left to the default glob: a bench file is
		 * the unit of measurement AND the unit of process startup, so handing one
		 * to two projects measures it twice and records whichever finished last.
		 */
		benchmark: { include: ["src/**/*.bench.ts"] },
	},
});
