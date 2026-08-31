import { lankaDiContract } from "../lanka-di-contract/lankaDiContract";
import { verifyLankaDi } from "../verify-lanka-di/verifyLankaDi";
import type { ILankaDiPluginOptions } from "../_interfaces/ILankaDiPluginOptions";

/** What every bundler adapter is built from, and what any other build can use. */
export interface ILankaDiSetup {
	/** The resolved `.lanka_di` directory, with forward slashes. */
	readonly dir: string;
	/** `{ "@lanka_di": "<root>/.lanka_di" }` — what most bundlers call an alias. */
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
	const root = (options.root ?? process.cwd()).replace(/\\/g, "/");
	const dir = `${root}/${lankaDiContract.dirname}`;

	return {
		dir,
		alias: Object.freeze({ [lankaDiContract.alias]: dir }),

		verify: () => {
			const report = verifyLankaDi(root, { scaffold: options.scaffold ?? true });

			if (report.problems.length > 0) {
				throw new Error(
					`lanka cannot use ${lankaDiContract.dirname}/ as it stands:\n\n  - ${report.problems.join("\n\n  - ")}\n`,
				);
			}

			return report.created;
		},
	};
};
