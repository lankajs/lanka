import { fileURLToPath } from "node:url";
import { build } from "vite";
import react from "@vitejs/plugin-react";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { isProvidedByThePage } from "./isProvidedByThePage";
import { lankaDiAlias } from "../../../../../tools/testing/src/vitest";
import type { IMicroFrontendBuild } from "./IMicroFrontendBuild";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

/**
 * Each module, built by Vite on its own — one `vite build` per module.
 *
 * One per module and not one build with several entries, deliberately: Rollup
 * hoists what two entries share into a common chunk, and a chunk both bundles
 * import is ONE copy of `lanka`. That would make "each module carries its own"
 * false in exactly the variant that exists to show it.
 */
export const buildWithVite = async ({ sharing, modules }: IMicroFrontendBuild): Promise<void> => {
	for (const { entry, name } of modules) {
		await build({
			configFile: false,
			root: ROOT,
			// "error": a third-party package's comment placement is Rollup's to warn
			// about and nobody here's to fix, and it buried the output of every run.
			logLevel: "error",
			plugins: [react(), svelte({ compilerOptions: { dev: true } })],
			// A bundled lanka reads the consumer's barrels through this alias, as it
			// would in any application; the test kit's fixture is enough, because
			// nothing here resolves a gateway by name.
			resolve: { alias: lankaDiAlias() },
			define: { "process.env.NODE_ENV": JSON.stringify("development") },
			build: {
				outDir: `dist/vite/${sharing}`,
				emptyOutDir: false,
				minify: false,
				lib: { entry, formats: ["es"], fileName: () => `${name}.js` },
				rollupOptions: { external: (id) => isProvidedByThePage(id, sharing) },
			},
		});
	}
};
