import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { DOM_TS_TESTS } from "./vitest.domTests";
import { lankaDiAlias } from "../tools/testing/src/vitest";

/**
 * Core's own test suite.
 *
 * ## `@lanka_di`
 *
 * The framework reads consumer barrels through this alias. Under test it
 * resolves to `testing/.lanka_di/`, the fixture generated from
 * `@lankajs/tool-di`'s stubs. Most specs mock it anyway, but the fixture is what
 * lets the rest — and the whole type layer — resolve.
 *
 * ## Why two projects
 *
 * Building a jsdom per file is the suite's most expensive line item. The list of
 * `.ts` tests that genuinely need a DOM lives beside this, in
 * `vitest.domTests.ts`.
 */

// The consumer-barrel fixture lives with the test kit: core is not its only
// user — any package importing `lanka` pulls in LankaScenarioBootstrap, which
// reads `@lanka_di/Scenarios`.
const DI = lankaDiAlias();

const plugins = () => [
	react({ jsxImportSource: "react", babel: { plugins: ["babel-plugin-react-compiler"] } }),
];

const shared = {
	globals: true,
	setupFiles: ["../tools/testing/src/setupTests.ts"],
	// 30s: a cold `await import(...)` after `vi.resetModules()` in a file's first
	// test regularly exceeds 15s on Windows under parallel load.
	testTimeout: 30000,
	alias: DI,
};

export default defineConfig({
	resolve: { alias: DI },
	test: {
		coverage: {
			provider: "v8",
			reporter: ["text-summary", "json-summary", "html"],
			reportsDirectory: "./coverage",
			include: ["src/**/*.{ts,tsx}"],
			exclude: [
				"src/**/*.{test,spec}.{ts,tsx}",
				// Benches run under `vitest bench`, which this run does not perform:
				// counted here they report 0% and drag the number that gates real code.
				"src/**/*.bench.ts",
				"src/**/*.bench.tsx",
				"src/**/*.d.ts",
				// Types and declarations only: v8 reports them as 0% because they emit
				// no instructions, so the number drops while saying nothing about what
				// is covered.
				"src/**/Types/**",
				"src/**/types/**",
				"src/**/Interfaces/**",
				"src/**/interfaces/**",
				"src/index.ts",
				// Declarations only, by rule 10 of the structure canon and checked
				// there. A file that compiles to nothing is reported as 0% and drags
				// the number that gates real code.
				"src/**/_types/**",
				"src/**/_interfaces/**",
			],
			// A RATCHET, not a target: the rule is to add missing tests, never to
			// lower a threshold.
			//
			// Measured twice, identically: 96.81 / 94.37 / 94.88 / 96.81
			// (statements / branches / functions / lines). Each threshold is that
			// minus one point, floored. The boundary scenes — a ViewModel under a
			// form, over a read cache, and both — moved it up from 95.88 / 93.33 /
			// 93.87 / 95.88, and the ratchet follows the measurement.
			//
			// The point of slack is deliberate: two consecutive runs of an unchanged
			// suite have differed in the hundredths here — something on the async
			// paths takes one branch or the other depending on the scheduler. A
			// threshold nailed to the best observation is not stricter, it just
			// fails on a coin toss, and a check that cries wolf stops being read.
			thresholds: {
				statements: 95,
				branches: 93,
				functions: 93,
				lines: 95,
			},
		},

		projects: [
			{
				plugins: plugins(),
				resolve: { alias: DI },
				test: {
					...shared,
					name: "node",
					environment: "node",
					include: ["src/**/*.test.ts"],
					exclude: [...DOM_TS_TESTS],
					/*
					 * Benches live beside what they measure, as tests do.
					 *
					 * Named explicitly rather than left to the default glob: the default
					 * hands the same bench file to BOTH projects, which measures it twice
					 * and records whichever finished last.
					 */
					benchmark: { include: ["src/**/*.bench.ts"] },
				},
			},
			{
				plugins: plugins(),
				resolve: { alias: DI },
				test: {
					...shared,
					name: "dom",
					environment: "jsdom",
					// The playground renders, so it belongs to the DOM project.
					include: ["src/**/*.test.tsx", "_playground/**/*.test.tsx", ...DOM_TS_TESTS],
					// A bench that renders: the DOM project owns those, by the same split.
					benchmark: { include: ["src/**/*.bench.tsx"] },
				},
			},
		],
	},
});
