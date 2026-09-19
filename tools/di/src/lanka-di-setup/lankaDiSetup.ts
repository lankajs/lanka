import { resolve } from "node:path";
import { lankaDiContract } from "../lanka-di-contract/lankaDiContract";
import { resolveLankaDiDir } from "../resolve-lanka-di-dir/resolveLankaDiDir";
import { verifyLankaDi } from "../verify-lanka-di/verifyLankaDi";
import type { ILankaDiPluginOptions } from "../_interfaces/ILankaDiPluginOptions";
import type { TLankaDiDirname } from "../lanka-di-contract/lankaDiContract";

/** What every bundler adapter is built from, and what any other build can use. */
export interface ILankaDiSetup {
	/** The resolved barrel directory, with forward slashes. */
	readonly dir: string;
	/** Its name — `.lanka` or `.lanka_di` — which is what `dir` ends with. */
	readonly dirname: TLankaDiDirname;
	/** `{ "@lanka_di": "<root>/<dirname>" }` — what most bundlers call an alias. */
	readonly alias: Readonly<Record<string, string>>;
	/**
	 * Scaffolds what is missing and refuses what cannot be scaffolded.
	 *
	 * Throws on a barrel that exists and no longer exports what the framework
	 * calls by name. Returns the paths it wrote, so a caller can say them in
	 * whatever way its bundler says things.
	 */
	readonly verify: () => readonly string[];
}

/**
 * The bundler-agnostic half of this package, and the answer for a bundler it has
 * no adapter for.
 *
 * ## Why a primitive rather than more adapters
 *
 * There are six adapters here and there will never be enough: a bundler arrives
 * every year, and an adapter for one nobody uses is an imagined need costing real
 * support. What every one of them does is the same three lines — take the alias,
 * hand it to the bundler in its own vocabulary, and call `verify()` once when a
 * build starts. Anything that can do those three lines is supported, whether or
 * not a file here mentions it.
 *
 * ```ts
 * const lanka = lankaDiSetup({ root: process.cwd() });
 *
 * lanka.verify();
 * myBundler.configure({ alias: lanka.alias });
 * ```
 */
export const lankaDiSetup = (options: ILankaDiPluginOptions = {}): ILankaDiSetup => {
	// Made ABSOLUTE before anything else reads it. A bundler's root is allowed
	// to be relative — `root: "app"` is an ordinary vite config — and every
	// bundler resolves it against the working directory before using it. Passing
	// the relative form straight through produces a relative ALIAS, and a
	// relative alias is not a path to vite: `app/.lanka/Gateways` is a bare
	// specifier, looked for in `node_modules` and not found. The directory check
	// below would meanwhile succeed, because `existsSync` resolves against the
	// same working directory — so the two halves disagree and only one says so.
	const root = resolve(options.root ?? process.cwd()).replace(/\\/g, "/");

	// Resolved once, and the same answer is handed to the alias and to the
	// verification. Asking twice would let a directory scaffolded BETWEEN the two
	// calls change the answer halfway through a build, and the alias — which
	// vite's `config` hook has already been given — would point at the other one.
	const { path: dir, dirname } = resolveLankaDiDir(root, { dirname: options.dirname });

	return {
		dir,
		dirname,
		alias: Object.freeze({ [lankaDiContract.alias]: dir }),

		verify: () => {
			const report = verifyLankaDi(root, {
				scaffold: options.scaffold ?? true,
				dirname,
			});

			if (report.problems.length > 0) {
				throw new Error(
					`lanka cannot use ${dirname}/ as it stands:\n\n  - ${report.problems.join("\n\n  - ")}\n`,
				);
			}

			return report.created;
		},
	};
};
