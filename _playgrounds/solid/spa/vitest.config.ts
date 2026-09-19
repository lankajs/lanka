import { fileURLToPath } from "node:url";
import solid from "vite-plugin-solid";
import { defineConfig } from "vitest/config";

/**
 * The Solid application's BROWSER suite.
 *
 * `resolve.conditions` names `development`, because Solid ships two builds and
 * the production one omits the ownership graph a test needs to dispose — a suite
 * that silently got the other one leaks an owner per scene and reports nothing.
 *
 * The `@lanka_di` alias points at THIS application's own barrels rather than at
 * the test kit's fixture, for the reason the Next, Nuxt, Kit and Angular suites
 * state: the server half resolves gateways BY NAME, so a fixture with empty
 * barrels would turn every such test into a named refusal. Pointing at the real
 * ones makes the barrels part of what is tested.
 *
 * ## `src/Core/Server` is excluded here, and has a config of its own
 *
 * The SAME components are compiled twice in this package, and the two
 * compilations cannot share a process. `vite-plugin-solid` emits DOM
 * instructions for a browser and string instructions for a render, and
 * `solid-js/web` has a matching pair of runtimes chosen by export condition —
 * given the wrong half of either pair a suite fails as "window is not defined"
 * or as "Client-only API called on the server side", both of them several frames
 * from the line that decided it. `vitest.server.config.ts` is the other half,
 * and `pnpm test` runs both.
 *
 * A RATCHET, not a target: add the missing test, never lower a number. Measured
 * twice, identically: 100 / 100 / 100 / 100 (statements / branches / functions /
 * lines), written down as the floor minus one — two runs of an unchanged suite
 * differ in the hundredths, and a threshold nailed to the best observation fails
 * on a coin toss.
 */
const barrels = fileURLToPath(new URL("./.lanka_di", import.meta.url));

const alias = { "@lanka_di": barrels };

export default defineConfig({
	plugins: [solid()],
	resolve: { alias, conditions: ["development", "browser"] },
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: ["../../../tools/testing/src/setupTests.ts"],
		alias,
		include: ["src/**/*.test.{ts,tsx}"],
		exclude: ["**/node_modules/**", "src/Core/Server/**"],
		coverage: {
			provider: "v8",
			include: ["src/**/*.{ts,tsx}"],
			exclude: [
				"src/**/*.test.{ts,tsx}",
				"src/index.tsx",
				"src/**/*.d.ts",
				"src/Core/Server/**",
			],
			thresholds: { statements: 99, branches: 99, functions: 99, lines: 99 },
		},
	},
});
