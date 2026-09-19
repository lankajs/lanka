import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * The device application's suite — everything except the device.
 *
 * `environment: "node"` and no renderer, deliberately. What can be tested off a
 * device is the logic: which screen the first frame chooses, which engine holds
 * what, and that a keychain's refusals are honoured. Rendering React Native
 * components needs a renderer this repository would then be testing instead.
 *
 * Every native module is handed in rather than imported, so a double is an
 * object of the engine's shape — which is what the three storage-adapter guides
 * prescribe, and why they export the engine interfaces at all.
 *
 * The `@lanka_di` alias points at THIS application's own barrels: the gateways
 * resolve by name, and a fixture with empty barrels would make every such test a
 * named refusal.
 *
 * Measured twice: 100 / 87.50 / 100 / 100 (statements / branches / functions /
 * lines). The thresholds are the measurement minus one; the rule is the
 * repository's — add the missing test, never lower a threshold.
 */
const barrels = fileURLToPath(new URL("./.lanka", import.meta.url));

export default defineConfig({
	resolve: { alias: { "@lanka_di": barrels } },
	test: {
		globals: true,
		environment: "node",
		setupFiles: ["../../../tools/testing/src/setupTests.ts"],
		alias: { "@lanka_di": barrels },
		include: ["src/**/*.test.ts"],
		coverage: {
			provider: "v8",
			include: ["src/Core/**/*.ts", "src/startAtlasDevice.ts"],
			exclude: ["src/**/*.test.ts"],
			thresholds: { statements: 99, branches: 86, functions: 99, lines: 99 },
		},
	},
});
