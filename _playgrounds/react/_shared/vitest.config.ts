import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { lankaDiAlias } from "../../../tools/testing/src/vitest";

/**
 * The React ecosystem's own suite.
 *
 * Everything here is shared by three applications, so a failure here is three
 * failures — which is the argument for testing it once, in the package that owns
 * it, rather than three times through the screens that consume it.
 *
 * `lankaDiAlias()` substitutes the test kit's `.lanka_di` fixture for an
 * application's barrels. It is needed even where nothing renders: anything
 * importing `lanka` pulls in the scenario bootstrap, which reads
 * `@lanka_di/Scenarios`.
 *
 * A RATCHET, not a target: add the missing test, never lower a number. These are
 * 100 across the board because the package is small enough that anything less
 * means a branch nobody drove — and the one place that would be tempting to
 * exempt, the DOM component, is the one three applications render.
 */
export default defineConfig({
	plugins: [react()],
	resolve: { alias: lankaDiAlias() },
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: ["../../../tools/testing/src/setupTests.ts"],
		alias: lankaDiAlias(),
		include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
		coverage: {
			provider: "v8",
			include: ["src/**/*.ts", "src/**/*.tsx"],
			exclude: [
				"src/**/*.test.ts",
				"src/**/*.test.tsx",
				// Barrels: a re-export compiles to nothing a branch can miss, and a
				// file reported as 0% would drag the number that gates real code.
				"src/index.ts",
				"src/dom.ts",
			],
			thresholds: {
				statements: 100,
				branches: 100,
				functions: 100,
				lines: 100,
			},
		},
	},
});
