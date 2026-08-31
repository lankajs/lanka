import { defineConfig } from "vitest/config";

/** Nothing browser-bound, and nothing framework-bound either — plain node. */
export default defineConfig({
	test: {
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
			 * Measured twice: 99.02 / 98.08 / 100.00 / 99.02
			 * (statements / branches / functions / lines).
			 *
			 * The threshold is the measured number floored minus one — never rounded
			 * up. A threshold above what the code achieves is not a ratchet but a
			 * check that fails for everyone until somebody lowers it.
			 *
			 * The rule is not negotiable: add the missing tests, NEVER lower a
			 * threshold.
			 */
			thresholds: {
				statements: 98,
				branches: 97,
				functions: 99,
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
