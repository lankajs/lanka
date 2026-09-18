import angular from "@analogjs/vite-plugin-angular";
import { defineConfig } from "vitest/config";
import { lankaDiAlias } from "../../../tools/testing/src/vitest";

/**
 * The Angular ecosystem's own suite.
 *
 * The compiler plugin is here and it is NOT in `modules/bindings/angular`, which
 * is the division this ecosystem exists to make: a binding drives signals and an
 * injector, both plain runtime APIs, while a component with a TEMPLATE needs the
 * whole Angular compiler. What a template proves is a consumer's build.
 *
 * `setupFiles` names this package's own file as well as the kit's: Angular's
 * `TestBed` has to be initialised once per process, and it is the one framework
 * here that cannot render without being told how first.
 *
 * A RATCHET, not a target: add the missing test, never lower a number. Measured
 * twice, identically: 100 / 100 / 100 / 100 (statements / branches / functions /
 * lines), written down as the floor minus one — two runs of an unchanged suite
 * differ in the hundredths, and a threshold nailed to the best observation fails
 * on a coin toss.
 */
export default defineConfig({
	plugins: [angular()],
	resolve: { alias: lankaDiAlias() },
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: ["../../../tools/testing/src/setupTests.ts", "./src/setupAngular.ts"],
		alias: lankaDiAlias(),
		include: ["src/**/*.test.ts"],
		coverage: {
			provider: "v8",
			include: ["src/**/*.ts"],
			exclude: ["src/**/*.test.ts", "src/index.ts", "src/setupAngular.ts"],
			thresholds: { statements: 99, branches: 99, functions: 99, lines: 99 },
		},
	},
});
