import { defineConfig } from "vitest/config";

/**
 * The API's own suite: node, no DOM, no framework.
 *
 * This package is the OTHER side of the wire, so nothing here imports lanka and
 * nothing needs the `.lanka_di` alias every other config in this repository
 * carries. A server that imported the framework would be testing the framework
 * against itself.
 *
 * Measured twice: 98.13 / 90.15 / 99.09 / 98.13 (statements / branches /
 * functions / lines). The thresholds are the measurement minus one — two runs of
 * an unchanged suite differ in the hundredths, and a threshold nailed to the
 * best observation fails on a coin toss. The rule is the repository's: add the
 * missing test, never lower a threshold.
 */
export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		include: ["src/**/*.test.ts"],
		coverage: {
			provider: "v8",
			include: ["src/**/*.ts"],
			exclude: [
				"src/**/*.test.ts",
				// The executable entry: it reads an environment variable and listens.
				// Covering it would mean binding a port from the coverage run.
				"src/main.ts",
				"src/**/_interfaces/**",
			],
			thresholds: {
				statements: 97,
				branches: 89,
				functions: 98,
				lines: 97,
			},
		},
	},
});
