/** One file a plan would write, and where it belongs. */
export interface ILankaInitFile {
	/** Relative to the project root, with forward slashes. */
	readonly path: string;
	/** The whole contents, ending in a newline. */
	readonly text: string;
	/** One clause saying what it is for, printed beside the path. */
	readonly gist: string;
	/**
	 * What to say when this file is already there and was therefore not written.
	 *
	 * Nothing overwrites, so a project that already has a `tsconfig.json` keeps
	 * it — and keeps whatever it says about `@lanka_di/*`, which is usually
	 * nothing. That is the one case where "kept your file" is not the end of the
	 * sentence, and this field is where the rest of it lives: on the file that
	 * knows, rather than in a condition inside the code that writes.
	 */
	readonly whenKept?: string;
}
