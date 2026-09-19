import { fileURLToPath } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

/**
 * The Nuxt application's suite.
 *
 * The `@lanka_di` alias points at THIS application's own barrels rather than at
 * the test kit's fixture, for the reason the Next application states: the server
 * half resolves gateways BY NAME, so a fixture with empty barrels would turn
 * every such test into a named refusal. Pointing at the real ones makes the
 * barrels part of what is tested.
 *
 * It tests the two halves this application owns: what runs on the server, and
 * the client component the server hands data to. Nothing here renders `app.vue`
 * — that would be testing Nuxt's own data fetching, which this repository does
 * not ship.
 *
 * A RATCHET, not a target: add the missing test, never lower a number. Measured
 * twice, identically: 100 / 100 / 100 / 100 (statements / branches / functions /
 * lines), written down as the floor minus one.
 */
const barrels = fileURLToPath(new URL("./.lanka", import.meta.url));

export default defineConfig({
	plugins: [vue()],
	resolve: { alias: { "@lanka_di": barrels } },
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: ["../../../tools/testing/src/setupTests.ts"],
		alias: { "@lanka_di": barrels },
		include: ["src/**/*.test.ts", "app/**/*.test.ts"],
		coverage: {
			provider: "v8",
			include: ["src/**/*.ts", "app/**/*.vue"],
			exclude: ["src/**/*.test.ts", "src/**/*.d.ts", "app/app.vue"],
			thresholds: {
				statements: 99,
				branches: 99,
				functions: 99,
				lines: 99,
			},
		},
	},
});
