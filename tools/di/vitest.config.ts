import { defineConfig } from "vitest/config";
import { lankaDiAlias } from "../testing/src/vitest";

/**
 * The build plugin writes real temporary directories and reads the consumer's
 * tsconfig: a node tool, tested as a node tool.
 */
export default defineConfig({
	// Importing `lanka` pulls in LankaScenarioBootstrap, which reads the consumer's
	// barrels. In a real application @lankajs/tool-di sets the alias; under test
	// this call does.
	resolve: { alias: lankaDiAlias() },
	test: {
		/*
		 * Measured twice: 98.62 / 95.00 / 88.88 / 98.62
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
			/*
			 * A RATCHET, not a target: add the missing test, never lower a number.
			 *
			 * Measured twice, identically: 99.32 / 96.51 / 95.65 / 99.32
			 * (statements / branches / functions / lines). Functions moved from 89
			 * when the sixth adapter arrived with its tests — the ratchet tightens
			 * with the suite, in the same commit.
			 *
			 * Branches stay at 96 rather than the measurement minus one, because
			 * the ratchet only tightens: 95 would be a loosening.
			 */
			thresholds: {
				statements: 98,
				branches: 96,
				functions: 94,
				lines: 98,
			},
		},
		globals: true,
		environment: "node",
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
