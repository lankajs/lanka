import { fileURLToPath } from "node:url";
import angular from "@analogjs/vite-plugin-angular";
import { defineConfig } from "vitest/config";

/**
 * The Angular application's suite.
 *
 * `setupFiles` names the ecosystem's own Angular setup as well as the kit's:
 * `TestBed` has to be initialised once per process, and Angular is the one
 * framework here that cannot render without being told how first.
 *
 * The `@lanka_di` alias points at THIS application's own barrels rather than at
 * the test kit's fixture, for the reason the Next, Nuxt and Kit suites state:
 * the server half resolves gateways BY NAME, so a fixture with empty barrels
 * would turn every such test into a named refusal. Pointing at the real ones
 * makes the barrels part of what is tested.
 *
 * A RATCHET, not a target: add the missing test, never lower a number. Measured
 * twice, identically: 100 / 100 / 100 / 100 (statements / branches / functions /
 * lines), written down as the floor minus one — two runs of an unchanged suite
 * differ in the hundredths, and a threshold nailed to the best observation fails
 * on a coin toss.
 */
const barrels = fileURLToPath(new URL("./.lanka", import.meta.url));

export default defineConfig({
	plugins: [angular()],
	resolve: { alias: { "@lanka_di": barrels } },
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: ["../../../tools/testing/src/setupTests.ts", "../_shared/src/setupAngular.ts"],
		alias: { "@lanka_di": barrels },
		include: ["src/**/*.test.ts"],
		coverage: {
			provider: "v8",
			include: ["src/**/*.ts"],
			exclude: ["src/**/*.test.ts", "src/main.ts", "src/**/*.d.ts"],
			thresholds: { statements: 99, branches: 99, functions: 99, lines: 99 },
		},
	},
});
