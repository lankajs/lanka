import { defineConfig } from "vitest/config";
import { lankaDiAlias } from "../../tools/testing/src/vitest";

/**
 * The plugin talks only to core, but core pulls in `LankaScenarioBootstrap`, which
 * reads the consumer's barrels — so the `.lanka_di` alias is needed here too.
 */
export default defineConfig({
	resolve: { alias: lankaDiAlias() },
	test: {
		/*
		 * Measured twice: 100 / 100 / 100 / 100
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
				// The second realm's application, which runs in a worker thread: v8 in
				// this process never sees it execute, and would report 0% for code the
				// realm scenes exercise completely.
				"src/_testing/**",
			],
			thresholds: {
				statements: 99,
				branches: 99,
				functions: 99,
				lines: 99,
			},
		},
		globals: true,
		environment: "jsdom",
		setupFiles: ["../../tools/testing/src/setupTests.ts"],
		include: ["src/**/*.test.ts", "_playground/**/*.test.ts"],
		// The published 0.1.0 is built JavaScript importing `lanka/*` by bare name.
		// Left to node, those resolve to the workspace's TypeScript sources and fail;
		// inlined, they go through the same resolver as this copy's — one lanka, two
		// relays, which is the page the protocol scenes describe.
		server: { deps: { inline: [/plugin-relay@0\.1\.0/] } },
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
