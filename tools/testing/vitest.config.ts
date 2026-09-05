import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { lankaDiAlias } from "./src/vitest";

/**
 * The kit tests itself.
 *
 * `renderWithLanka` and `resetLanka` are what EVERY test of every consumer rests
 * on. A broken kit turns them all red at once, and the investigation starts far
 * from the break; its own test catches it in place.
 */
export default defineConfig({
	plugins: [react()],
	resolve: { alias: lankaDiAlias() },
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: ["./src/setupTests.ts"],
		include: ["src/**/*.test.{ts,tsx}", "_playground/**/*.test.{ts,tsx}"],
		/*
		 * Benches live beside what they measure, as tests do.
		 *
		 * Named explicitly rather than left to the default glob: a bench file is
		 * the unit of measurement AND the unit of process startup, so handing one
		 * to two projects measures it twice and records whichever finished last.
		 */
		benchmark: { include: ["src/**/*.bench.ts"] },
		/*
		 * Measured twice: 98.87 / 98.23 / 93.02 / 98.87
		 * (statements / branches / functions / lines). The threshold is the lower
		 * run minus one; see the same comment in the other packages' configs.
		 *
		 * The floor rose from 92 / 87 / 68 / 92 when the recorders, the waiter and
		 * the fake registry arrived with their own tests. A ratchet only tightens:
		 * the number moves up because tests raised it, and never down to let a run
		 * pass.
		 *
		 * Functions sit lower than the rest: `setupTests` is a setup file and vitest
		 * runs its hooks, not a test. There is nothing here to measure them with,
		 * and chasing the number would produce a test asserting that a hook was
		 * called rather than what it caused.
		 */
		coverage: {
			provider: "v8",
			include: ["src/**/*.{ts,tsx}"],
			exclude: [
				"src/**/*.test.{ts,tsx}",
				// Benches run under `vitest bench`, which this run does not perform:
				// counted here they report 0% and drag the number that gates real code.
				"src/**/*.bench.ts",
				"src/**/*.bench.tsx",
				// Declarations only, by rule 10 of the structure canon and checked
				// there. A file that compiles to nothing is reported as 0% and drags
				// the number that gates real code.
				"src/**/_types/**",
				"src/**/_interfaces/**",
				// Runs under `vitest bench` and nowhere else, which this run does not
				// perform: the same case as `setupTests` below. Counting it measures
				// the absence of a run, not the absence of a test.
				"src/lankaBenchCalibration.ts",
			],
			thresholds: {
				statements: 97,
				branches: 97,
				functions: 92,
				lines: 97,
			},
		},
	},
});
