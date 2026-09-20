import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { lankaDiAlias } from "../../../tools/testing/src/vitest";

/**
 * A binding renders, so every file here needs a DOM.
 *
 * No two-project split, unlike core: core is mostly framework-free and building
 * a jsdom per file is its biggest line item, while this package is a hook and a
 * render helper and nothing in it can be measured without one.
 */
export default defineConfig({
	plugins: [react()],
	resolve: { alias: lankaDiAlias() },
	test: {
		/*
		 * A RATCHET, not a target: add the missing test, never lower a number.
		 *
		 * Measured twice, identically: 100 / 97.05 / 100 / 100
		 * (statements / branches / functions / lines), and written down as the floor
		 * minus one — two runs of an unchanged suite differ in the hundredths, and a
		 * threshold nailed to the best observation fails on a coin toss.
		 *
		 * Up from 99.14 / 95.91 / 100 / 99.14 when `_playground/migration.test.tsx`
		 * landed. It drives `testing.ts`, which nothing here had imported — a
		 * consumer reaches it by a different specifier, and the entry the 2.0
		 * migration sends every React consumer to was the entry no suite loaded.
		 *
		 * What is left uncovered is the selector arms a component cannot take both
		 * of at once.
		 */
		coverage: {
			provider: "v8",
			include: ["src/**/*.{ts,tsx}"],
			exclude: [
				"src/**/*.{test,spec}.{ts,tsx}",
				"src/**/*.bench.{ts,tsx}",
				// Declarations only, by rule 10 of the structure canon. A file that
				// compiles to nothing is reported as 0% and drags the number that
				// gates real code.
				"src/**/_types/**",
				"src/**/_interfaces/**",
			],
			thresholds: {
				statements: 99,
				branches: 96,
				functions: 99,
				lines: 99,
			},
		},
		globals: true,
		environment: "jsdom",
		setupFiles: ["@lankajs/tool-testing/setupTests"],
		testTimeout: 30000,
		include: ["src/**/*.test.{ts,tsx}", "_playground/**/*.test.{ts,tsx}"],
		benchmark: { include: ["src/**/*.bench.tsx"] },
	},
});
