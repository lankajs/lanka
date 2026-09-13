import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * The Next application's suite.
 *
 * The `@lanka_di` alias points at THIS application's own barrels rather than at
 * the test kit's fixture, and that is deliberate: the server half resolves
 * gateways BY NAME, so a fixture with empty barrels would turn every such test
 * into a named refusal. Pointing at the real ones makes the barrels themselves
 * part of what is tested — and they are otherwise checked only by a build.
 *
 * It tests the two halves this application owns: what runs on the server, and
 * the client components the server hands data to. Nothing here renders a
 * `page.tsx` — that would be testing a router this repository does not ship.
 *
 * Measured twice: 98.57 / 90.90 / 100 / 98.57 (statements / branches /
 * functions / lines). The thresholds are the measurement minus one; the rule is
 * the repository's — add the missing test, never lower a threshold.
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
			thresholds: { statements: 97, branches: 89, functions: 99, lines: 97 },
		},
	},
});
