import { defineConfig } from "vitest/config";

/**
 * The repository's own guard scripts.
 *
 * They live at the root rather than in a package: they are never published, and
 * the four workspace buckets hold packages only. `pnpm -r` therefore does not
 * see them, so `pnpm check` calls `test:scripts` separately.
 *
 * Each test spawns the real script against a temporary tree and asserts the exit
 * code, because that is what a contributor and CI act on.
 */
export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		include: ["scripts/**/*.test.mjs"],
	},
});
