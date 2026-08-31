import { defineConfig } from "vitest/config";

/**
 * A CLI over a file-system port: plain node, no DOM, no framework.
 *
 * The port is what makes the suite meaningful — every decision runs against a
 * fake that records instead of writing, so "did not overwrite" is an assertion
 * rather than something discovered on somebody's repository.
 */
export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		include: ["src/**/*.test.ts", "_playground/**/*.test.ts"],
		coverage: {
			provider: "v8",
			include: ["src/**/*.ts"],
			exclude: [
				"src/**/*.test.ts",
				// Declarations only, by rule 10 of the structure canon. A file that
				// compiles to nothing is reported as 0% and drags the number that gates
				// real code.
				"src/**/_types/**",
				"src/**/_interfaces/**",
				// The executable. Three lines that run at import, and reaching them from
				// a test means running the program — which is why the command itself is
				// a function next door, covered in full.
				"src/cli.ts",
				// The node file system, and nothing else. Every decision above it is
				// tested against the fake; covering this would test `node:fs`.
				"src/_adapters/**",
				// The fake file system the tests run against. Counting a test double's
				// own branches measures the tests, and the number that gates real code
				// should not move when a double grows a convenience.
				"src/_testing/**",
			],
			/*
			 * Measured twice: 100 / 100 / 100 / 100
			 * (statements / branches / functions / lines). The thresholds sit one
			 * below, as in every other package: a number nailed to the best
			 * observation fails on a coin toss rather than on a regression.
			 */
			thresholds: {
				statements: 99,
				branches: 99,
				functions: 99,
				lines: 99,
			},
		},
	},
});
