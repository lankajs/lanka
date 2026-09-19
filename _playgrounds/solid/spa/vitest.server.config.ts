import { fileURLToPath } from "node:url";
import solid from "vite-plugin-solid";
import { defineConfig } from "vitest/config";

/**
 * The Solid application's SERVER suite, in the same project and a second config.
 *
 * `ssr: true` is what lets the plugin read the transform mode at all: without it
 * every file is compiled for the DOM whatever environment asked for it, and
 * `renderToString` meets DOM instructions and fails on `window`. With it, the
 * node environment gets string instructions and `solid-js/web` resolves to the
 * runtime that produces strings.
 *
 * ## Why a second FILE and not a second project
 *
 * `test.projects` was the obvious spelling and does not work here: inside a
 * project entry `vite-plugin-solid` stops seeing test mode, drops the `browser`
 * export condition, and hands the browser suite Solid's SERVER build — twenty
 * scenes failing as "Client-only API called on the server side" with nothing in
 * the config that says so. Two flat configs are what the plugin supports, so
 * `pnpm test` runs them one after the other and each measures its own half.
 *
 * `ssr.resolve.conditions` is set rather than left to Vite's default so that the
 * choice is written down beside the reason: `node` picks `web/dist/server.js`,
 * which is the only build with `renderToString` in it.
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
	plugins: [solid({ ssr: true })],
	resolve: { alias },
	ssr: { resolve: { conditions: ["development", "node"] } },
	test: {
		globals: true,
		environment: "node",
		setupFiles: ["../../../tools/testing/src/setupTests.ts"],
		alias,
		include: ["src/Core/Server/**/*.test.ts"],
		coverage: {
			provider: "v8",
			include: ["src/Core/Server/**/*.ts"],
			exclude: ["src/Core/Server/**/*.test.ts"],
			thresholds: { statements: 99, branches: 99, functions: 99, lines: 99 },
		},
	},
});
