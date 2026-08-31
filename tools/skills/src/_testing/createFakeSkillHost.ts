import type { ILankaSkillHost } from "../_interfaces/ILankaSkillHost";

/** What a fake file system was asked to do, in order. */
export interface IFakeSkillHost extends ILankaSkillHost {
	readonly copies: readonly { from: string; to: string }[];
	readonly writes: readonly { path: string; text: string }[];
	/** Adds a path as if it existed, so a later plan sees it. */
	readonly add: (path: string) => void;
}

export interface IFakeSkillHostState {
	/** Paths that exist. Directories and files alike — the port only asks. */
	paths?: readonly string[];
	/**
	 * Where a package resolves to, by name.
	 *
	 * Unset means the ordinary layout — `<root>/node_modules/<name>` — which is
	 * what most projects have. A test that is ABOUT resolution says otherwise:
	 * hoisting to a workspace root, or a project with no `node_modules` at all.
	 */
	packages?: Record<string, string>;
	/** JSON files, by path. */
	json?: Record<string, unknown>;
	/** Directory listings, by path. */
	directories?: Record<string, readonly string[]>;
}

/**
 * A file system that records instead of writing.
 *
 * One fake for every test in this package rather than a stub per file: the
 * interesting assertions are about what was NOT written, and those only mean
 * something if every test agrees on what "written" looks like.
 */
export const createFakeSkillHost = (state: IFakeSkillHostState = {}): IFakeSkillHost => {
	const paths = new Set(state.paths ?? []);
	const copies: { from: string; to: string }[] = [];
	const writes: { path: string; text: string }[] = [];

	return {
		copies,
		writes,
		add: (path) => paths.add(path),

		readJsonFile: (path) => state.json?.[path] ?? null,

		resolvePackageDir: (packageName, from) => {
			const declared = state.packages?.[packageName];
			if (declared !== undefined) return declared;

			const conventional = `${from}/node_modules/${packageName}`;
			return paths.has(conventional) || paths.has(`${conventional}/skills`)
				? conventional
				: null;
		},
		listDirectories: (path) => state.directories?.[path] ?? [],
		exists: (path) => paths.has(path),

		copyDirectory: (from, to) => {
			copies.push({ from, to });
			paths.add(to);
		},

		writeTextFile: (path, text) => {
			writes.push({ path, text });
			paths.add(path);
		},
	};
};
