import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * The headless application's suite, in node and nowhere else.
 *
 * `environment: "node"` and not jsdom, and that is not a preference — it is the
 * subject. Every other playground here proves lanka works with a document; this
 * one proves it works without one, and a jsdom under it would quietly supply the
 * thing being disproved. It also means `fetch` and `AbortController` come from
 * one realm, so the live scenes need none of the care the browser applications'
 * live suites take.
 *
 * The `@lanka_di` alias points at THIS application's own barrels rather than at
 * the test kit's fixture, for the reason the Next application states: the server
 * half resolves gateways BY NAME, so a fixture with empty barrels would turn
 * every such test into a named refusal. Pointing at the real ones makes the
 * barrels part of what is tested.
 *
 * Measured twice, identically: 100 / 93.93 / 100 / 100 (statements / branches /
 * functions / lines). The thresholds are the measurement minus one: two runs of
 * an unchanged suite differ in the hundredths, and a number nailed to the best
 * observation fails on a coin toss. Add the missing test, never lower a
 * threshold.
 *
 * The two uncovered branches are a header sent twice — node hands an array and
 * the forwarding layer takes a string — and the `address()` shape node's own
 * types allow but a listening TCP server never returns.
 */
const barrels = fileURLToPath(new URL("./.lanka", import.meta.url));

export default defineConfig({
	resolve: { alias: { "@lanka_di": barrels } },
	test: {
		globals: true,
		environment: "node",
		alias: { "@lanka_di": barrels },
		testTimeout: 30000,
		include: ["src/**/*.test.ts"],
		coverage: {
			provider: "v8",
			include: ["src/**/*.ts"],
			exclude: ["src/**/*.test.ts", "src/main.ts"],
			thresholds: { statements: 99, branches: 92, functions: 99, lines: 99 },
		},
	},
});
