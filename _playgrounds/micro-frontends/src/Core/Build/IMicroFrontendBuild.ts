/**
 * How a module's build treats `lanka`.
 *
 * - `one-lanka` — `lanka` is external: the page provides ONE copy, the way a
 *   Module Federation singleton or an import map does. Everything else — the
 *   application code, the binding, the scenario definitions — is inside the
 *   bundle, a copy per module.
 * - `own-lanka` — the module carries its own `lanka`: by accident, which core
 *   warns about, or on purpose, with a relay to hear the rest of the page.
 */
export type TLankaSharing = "one-lanka" | "own-lanka";

/** The two bundlers a module's team might have chosen, independently of each other. */
export type TMicroFrontendBundler = "vite" | "webpack";

export interface IMicroFrontendEntry {
	/** The module's entry, relative to this application's root. */
	readonly entry: string;
	/** The bundle's file name, without the extension. */
	readonly name: string;
}

/** One pipeline's run: which bundler, what it shares, and the modules it builds. */
export interface IMicroFrontendBuild {
	readonly bundler: TMicroFrontendBundler;
	readonly sharing: TLankaSharing;
	readonly modules: readonly IMicroFrontendEntry[];
}
