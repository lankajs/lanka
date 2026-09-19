import solid from "vite-plugin-solid";
import { defineConfig } from "vitest/config";
import { lankaDiAlias } from "../../../tools/testing/src/vitest";

/**
 * A binding renders, so every file here needs a DOM.
 *
 * The Solid plugin is here because the conformance adapter renders a real
 * component — the same thing React's and Vue's do — and Solid's JSX is compiled
 * rather than interpreted. The package's own `src/` needs none of it: a signal
 * and a subscription are plain TypeScript, which is why this builds with `tsup`
 * like every other package here.
 *
 * `resolve.conditions` names `development`, because Solid ships two builds and
 * the production one omits the ownership graph a test needs to dispose.
 */
export default defineConfig({
	plugins: [solid()],
	resolve: {
		alias: lankaDiAlias(),
		conditions: ["development", "browser"],
	},
	test: {
		/*
		 * A RATCHET, not a target: add the missing test, never lower a number.
		 *
		 * Measured twice, identically: 100 / 100 / 100 / 100
		 * (statements / branches / functions / lines), and written down as the floor
		 * minus one — two runs of an unchanged suite differ in the hundredths, and a
		 * threshold nailed to the best observation fails on a coin toss.
		 *
		 * Nothing is uncovered any more: the owner-less arm has a scene of its own
		 * beside the unit, and `renderWithLanka.tsx` finally appears in the report at
		 * all — a `.ts`-only include pattern had been leaving it out.
		 */
		coverage: {
			provider: "v8",
			// `{ts,tsx}`, not `ts`: `renderWithLanka.tsx` renders a component, and a
			// `.ts`-only glob left it out of the report entirely — a file with no row
			// in the table cannot move the ratchet, however well it is tested.
			include: ["src/**/*.{ts,tsx}"],
			exclude: [
				"src/**/*.{test,spec}.{ts,tsx}",
				"src/**/*.bench.{ts,tsx}",
				"src/**/_types/**",
				"src/**/_interfaces/**",
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
		setupFiles: ["@lankajs/tool-testing/setupTests"],
		testTimeout: 30000,
		include: ["src/**/*.test.{ts,tsx}", "_playground/**/*.test.{ts,tsx}"],
	},
});
