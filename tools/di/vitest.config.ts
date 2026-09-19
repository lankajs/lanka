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
				// The executable. Three lines that run at import, and reaching them
				// from a test means running the program — which is why the command
				// itself is a function next door, covered in full. The same exclusion,
				// for the same reason, as `@lankajs/tool-skills`.
				"src/cli.ts",
			],
			/*
			 * A RATCHET, not a target: add the missing test, never lower a number.
			 *
			 * Measured twice, identically: 100 / 98.19 / 100 / 100
			 * (statements / branches / functions / lines). Functions moved from 89
			 * when the sixth adapter arrived with its tests, and the rest reached
			 * 100 when the second barrel directory arrived with its own — the
			 * ratchet tightens with the suite, in the same commit.
			 *
			 * It only tightens. When the migration first landed branches measured
			 * 95.67 against a threshold of 96, and the fix was to delete three
			 * defensive branches no run could take — not to write the 96 down.
			 *
			 * The last uncovered branch is the webpack adapter's
			 * `failure instanceof Error` arm, and it stays. Nothing this package
			 * throws is a non-Error, so no test can take it honestly; removing it
			 * would hand webpack's callback an `undefined` on a stray throw, which
			 * is a failed build reported as a passing one.
			 */
			thresholds: {
				statements: 100,
				branches: 98,
				functions: 100,
				lines: 100,
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
