import { defineConfig } from "vitest/config";

/**
 * Lint rules are plain node code: no DOM, no framework.
 */
export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		include: ["src/**/*.test.ts", "_playground/**/*.test.ts"],
		/*
		 * Benches live beside what they measure, as tests do.
		 *
		 * Named explicitly rather than left to the default glob: a bench file is
		 * the unit of measurement AND the unit of process startup, so handing one
		 * to two projects measures it twice and records whichever finished last.
		 */
		benchmark: { include: ["src/**/*.bench.ts"] },
		/*
		 * Measured twice: 100 / 96.96 / 100 / 100
		 * (statements / branches / functions / lines). The threshold is the lower
		 * observation minus one, as in every other package.
		 *
		 * What is uncovered is a handful of defensive branches on syntax the rules
		 * decline to read — a base named through a namespace, an option nobody set.
		 */
		coverage: {
			provider: "v8",
			include: ["src/**/*.ts"],
			exclude: [
				"src/**/*.test.ts",
				// Benches run under `vitest bench`, which this run does not perform:
				// counted here they report 0% and drag the number that gates real code.
				"src/**/*.bench.ts",
				"src/**/*.bench.tsx",
				// Declarations only, by rule 10 of the structure canon and checked
				// there. A file that compiles to nothing is reported as 0% and drags
				// the number that gates real code.
				"src/**/_types/**",
				"src/**/_interfaces/**",
			],
			thresholds: {
				statements: 99,
				branches: 95,
				functions: 99,
				lines: 99,
			},
		},
	},
});
