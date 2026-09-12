import { defineConfig } from "vitest/config";
import { lankaDiAlias } from "../../../tools/testing/src/vitest";

/** A mapping over an injected object — no DOM, and no device either. */
export default defineConfig({
	resolve: { alias: lankaDiAlias() },
	test: {
		/*
		 * Measured twice, identically: 100 / 100 / 100 / 100
		 * (statements / branches / functions / lines).
		 *
		 * The threshold is the lower of two runs minus one, except where the number
		 * is 100 and every branch is reachable from a scene — there is nothing for a
		 * scheduler to take differently in a synchronous mapping.
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
				// Declarations only, by rule 10 of the structure canon and checked
				// there. A file that compiles to nothing is reported as 0% and drags
				// the number that gates real code.
				"src/**/_types/**",
				"src/**/_interfaces/**",
			],
			thresholds: {
				statements: 100,
				branches: 100,
				functions: 100,
				lines: 100,
			},
		},
		globals: true,
		environment: "node",
		testTimeout: 30000,
		include: ["src/**/*.test.ts", "_playground/**/*.test.ts"],
		benchmark: { include: ["src/**/*.bench.ts"] },
	},
});
