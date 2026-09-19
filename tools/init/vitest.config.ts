import { defineConfig } from "vitest/config";

/**
 * A command over a port: plain node, no DOM, no framework.
 *
 * The port is what makes the suite meaningful. Every decision runs against a
 * fake that records instead of writing, answering instead of asking and
 * counting instead of installing — so "did not overwrite", "did not ask" and
 * "did not install" are assertions rather than things discovered on somebody's
 * repository.
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
				// Declarations only, by the structure canon. A file that compiles to
				// nothing is reported as 0% and drags the number that gates real code.
				"src/**/_types/**",
				"src/**/_interfaces/**",
				// The executable. Four lines that run at import, and reaching them from
				// a test means running the program — which is why the command itself is
				// a function next door, covered in full.
				"src/cli.ts",
				// A real disk, a real package manager and a real person. Every decision
				// above it is tested against the fake; covering this would test
				// `node:fs`, `node:child_process` and a terminal.
				"src/_adapters/**",
				// The fake the tests run against. Counting a double's own branches
				// measures the tests, and the number that gates real code should not
				// move when a double grows a convenience.
				"src/_testing/**",
			],
			/*
			 * Measured twice: 100 / 95.95 and 95.93 / 100 / 100
			 * (statements / branches / functions / lines). The thresholds sit one
			 * below, as in every other package: a number nailed to the best
			 * observation fails on a coin toss, and a gate that cries wolf stops
			 * being read. Add the missing test; never lower a threshold.
			 *
			 * The branches that are not covered are the `??` fallbacks over states
			 * this package's own shape makes impossible, and they are listed so the
			 * next reader does not go hunting: a barrel the contract grows and this
			 * package has no gist for, a screen kind with no entry in the table, a
			 * validator with no import line to read a name out of, a manifest that
			 * is missing after the plan has just written one. Each is a default for
			 * a state that would otherwise be an exception in somebody's terminal.
			 */
			thresholds: { statements: 99, branches: 94, functions: 99, lines: 99 },
		},
	},
});
