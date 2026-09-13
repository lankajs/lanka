import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * The Astro application's suite.
 *
 * The `@lanka_di` alias points at THIS application's own barrels rather than at
 * the test kit's fixture: the server half resolves gateways by name, so a
 * fixture with empty barrels would turn every such test into a named refusal —
 * and pointing at the real ones makes the barrels part of what is tested.
 *
 * Nothing here renders a `.astro` file. That would be testing Astro, and the
 * decisions this application makes are ordinary modules under `src/`.
 *
 * Measured twice: 100 / 85.71 / 100 / 100 (statements / branches / functions /
 * lines). The thresholds are the measurement minus one; the rule is the
 * repository's — add the missing test, never lower a threshold.
 */
const barrels = fileURLToPath(new URL("./.lanka_di", import.meta.url));

export default defineConfig({
	plugins: [react()],
	resolve: { alias: { "@lanka_di": barrels } },
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: ["../../tools/testing/src/setupTests.ts"],
		alias: { "@lanka_di": barrels },
		include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
		coverage: {
			provider: "v8",
			include: ["src/**/*.ts", "src/**/*.tsx"],
			exclude: ["src/**/*.test.ts", "src/**/*.test.tsx"],
			thresholds: { statements: 99, branches: 84, functions: 99, lines: 99 },
		},
	},
});
