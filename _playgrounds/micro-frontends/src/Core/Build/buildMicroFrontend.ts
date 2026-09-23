import { fileURLToPath } from "node:url";
import { build } from "vite";
import react from "@vitejs/plugin-react";
import { lankaDiAlias } from "../../../../../tools/testing/src/vitest";

/**
 * How a module's build treats `lanka`.
 *
 * - `one-lanka` — `lanka` is external: the page provides ONE copy, the way a
 *   Module Federation singleton or an import map does. Everything else — the
 *   application code, the binding, the scenario definitions — is inside the
 *   bundle, a copy per module.
 * - `own-lanka` — the module carries its own `lanka`. The accident this
 *   application exists to show being caught.
 */
export type TLankaSharing = "one-lanka" | "own-lanka";

export interface IMicroFrontendBuild {
	/** The module's entry, relative to this application's root. */
	entry: string;
	/** The bundle's file name, without the extension. */
	name: string;
	sharing: TLankaSharing;
}

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

/**
 * The UI frameworks, which the page provides in either variant.
 *
 * Not the claim, and external only so that each build takes a second rather
 * than bundling React: whether a module ships its own React is a question about
 * React. The claim is about the one line below that differs between variants.
 */
const FRAMEWORKS = /^(react|react-dom|vue)(\/|$)/;

const LANKA = /^lanka(\/|$)/;

/**
 * One module, built on its own, as its team's pipeline would build it.
 *
 * A real `vite build` of a library entry, not a module graph reset in a test:
 * what makes two copies is a bundler inlining a package, and the only honest
 * way to show that is to let a bundler do it.
 */
export const buildMicroFrontend = async ({ entry, name, sharing }: IMicroFrontendBuild) => {
	await build({
		configFile: false,
		root: ROOT,
		logLevel: "warn",
		plugins: [react()],
		// A bundled lanka reads the consumer's barrels through this alias, as it
		// would in any application; the test kit's fixture is enough, because
		// nothing here resolves a gateway by name.
		resolve: { alias: lankaDiAlias() },
		define: { "process.env.NODE_ENV": JSON.stringify("development") },
		build: {
			outDir: `dist/${sharing}`,
			emptyOutDir: false,
			minify: false,
			lib: { entry, formats: ["es"], fileName: () => `${name}.js` },
			rollupOptions: {
				external: (id) =>
					FRAMEWORKS.test(id) || (sharing === "one-lanka" && LANKA.test(id)),
			},
		},
	});
};
