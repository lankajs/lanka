import { defineConfig } from "vitest/config";
import { lankaDiAlias } from "../../../tools/testing/src/vitest";

/**
 * The test kit under Vitest 4.
 *
 * No aliasing is needed to make the kit's suites register here, and none is
 * configured: Vitest answers every import of `vitest` in a run with ITSELF,
 * whichever copy sits beside the importer — the kit is workspace source with
 * Vitest 3 beside it, and its `describe` and `it` still reach this runner. The
 * first scene asserts which major is running, and the conformance suite passes
 * only if its scenes registered.
 */
export default defineConfig({
	resolve: { alias: lankaDiAlias() },
	test: {
		globals: true,
		environment: "node",
		setupFiles: ["../../../tools/testing/src/setupTests.ts"],
		testTimeout: 30000,
		include: ["src/**/*.test.ts"],
	},
});
