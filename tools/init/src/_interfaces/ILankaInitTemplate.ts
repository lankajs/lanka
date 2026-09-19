import type { TLankaInitRuntime } from "../_types/TLankaInitRuntime";

/** Which UI framework's binding a template wires, or none at all. */
export type TLankaInitFramework = "react" | "vue" | "svelte" | "solid" | "angular";

/**
 * Which build the config files are written for.
 *
 * The one axis a template cannot share with another, and the reason templates
 * exist at all: everything above the build is the same five files whichever of
 * these it is.
 */
export type TLankaInitBuild = "vite" | "next" | "nuxt" | "sveltekit" | "metro" | "none";

/**
 * A project shape this command knows how to wire.
 *
 * A template is a row of DATA and never a code path. What differs between two of
 * them is which packages they name, which bundler config is written and which
 * screen file the binding gets — and all three are fields, so a twelfth template
 * is an entry in one table rather than an edit inside four functions.
 */
export interface ILankaInitTemplate {
	/** What `--template react-spa` is typed as. */
	readonly id: string;
	readonly title: string;
	readonly gist: string;
	/** Everywhere this project's code runs; the first is the one it mainly is. */
	readonly runtime: readonly TLankaInitRuntime[];
	/** The binding to install and the screen to write, or `null` for no UI framework. */
	readonly framework: TLankaInitFramework | null;
	readonly build: TLankaInitBuild;
	/**
	 * The import line and the call that puts the framework's own plugin into the
	 * vite config, when the build is one vite reads.
	 */
	readonly vitePlugin?: { readonly importLine: string; readonly call: string };
	readonly packages: readonly string[];
	readonly devPackages: readonly string[];
	/** What each axis answers when nobody says otherwise. */
	readonly defaults: {
		readonly validator: string;
		readonly transport: string;
		readonly storage: string;
		readonly extras: readonly string[];
	};
	/** What this template cannot do for the project, said where it is chosen. */
	readonly notes: readonly string[];
}
