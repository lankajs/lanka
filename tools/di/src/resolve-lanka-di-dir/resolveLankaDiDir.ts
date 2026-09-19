import { statSync } from "node:fs";
import { lankaDiContract } from "../lanka-di-contract/lankaDiContract";
import type { TLankaDiDirname } from "../lanka-di-contract/lankaDiContract";

/** Which directory a project publishes its barrels in, and what that was read from. */
export interface ILankaDiDir {
	/** The directory name in use, relative to the project root. */
	readonly dirname: TLankaDiDirname;
	/** Its absolute path, with forward slashes — what a bundler is handed. */
	readonly path: string;
	/**
	 * Every recognised directory that is actually on disk, the one in USE first.
	 *
	 * Empty on a project that has not been scaffolded yet. TWO is a supported
	 * layout rather than a mistake — a team may split its wiring by abstraction
	 * or shard one barrel across the pair — and the first entry is the one the
	 * alias resolves to, which is the fact everything else hangs off.
	 *
	 * Ordered by whether a directory HOLDS a barrel before the contract's own
	 * preference, which is the difference between reading a layout and reading a
	 * coincidence. See the ordering note on the function.
	 */
	readonly found: readonly TLankaDiDirname[];
}

/** What the caller may say about the directory, when it wants to say anything. */
export interface IResolveLankaDiDirOptions {
	/**
	 * Use this directory, whatever is on disk.
	 *
	 * For a project that wants its layout written down rather than discovered —
	 * and for the migration, which has to address a directory that does not exist
	 * yet.
	 */
	readonly dirname?: TLankaDiDirname;
}

/**
 * Where this project's barrels live.
 *
 * ## Why this is a lookup and not a constant
 *
 * There are two legal directory names, `.lanka` and `.lanka_di`, and the second
 * is not a deprecation — it is what the first consumers were given and it keeps
 * working. So "which one" is not a fact about the framework that a constant
 * could hold; it is a fact about the project in front of it, and the only honest
 * way to get it is to look.
 *
 * ## The order, and what it is NOT allowed to do
 *
 * 1. an explicit `dirname` wins — it is the project saying it out loud;
 * 2. otherwise, a directory that HOLDS a barrel, `.lanka` first;
 * 3. otherwise a directory that merely exists, `.lanka` first;
 * 4. otherwise the default, which is what a NEW project gets.
 *
 * Step 2 before step 4 is the whole compatibility story: a project on
 * `.lanka_di` that upgrades is resolved to `.lanka_di`, so the new default never
 * reaches a project that already made a choice. Getting that order backwards
 * would scaffold an empty `.lanka` beside a working `.lanka_di` and start the
 * application against the empty one.
 *
 * Step 2 before step 3 is the same sentence for the case that arrived with
 * sharding. An empty `.lanka` beside a working `.lanka_di` is not a layout — it
 * is an editor that made a folder, a migration that left one, or the framework
 * itself, which reserves that name for whatever else it may one day keep beside
 * the barrels. Ranking by EXISTENCE would hand the alias to the empty one and
 * rewrite a working project's wiring on the strength of a coincidence. Ranking
 * by contents cannot: a directory with no barrel in it never outranks one with
 * six.
 *
 * ## Both present
 *
 * A LAYOUT, and this still answers with one directory — the one the alias
 * resolves to. That is not a choice between them: `@lanka_di/*` is a path
 * substitution and substitutes one path, so a project using both has a primary
 * whatever else is true of it, and what the other directory holds reaches the
 * framework through a re-export in this one.
 *
 * `found` carries both, and `resolveLankaDiShards` is what reads them barrel by
 * barrel. Nothing here decides anything about the second directory;
 * `verifyLankaDi` does, and what it decides is whether every shard is joined to
 * the barrel the framework actually reads.
 */
export const resolveLankaDiDir = (
	root: string,
	options: IResolveLankaDiDirOptions = {},
): ILankaDiDir => {
	const base = root.replace(/\\/g, "/").replace(/\/+$/, "");
	const present = lankaDiContract.dirnames.filter((dirname) => isDirectory(`${base}/${dirname}`));
	const found = [
		...present.filter((dirname) => holdsABarrel(base, dirname)),
		...present.filter((dirname) => !holdsABarrel(base, dirname)),
	];
	const dirname = options.dirname ?? found[0] ?? lankaDiContract.dirname;

	return { dirname, path: `${base}/${dirname}`, found };
};

/**
 * Any barrel at all, which is what makes a directory a barrel directory.
 *
 * ANY and not all: a project part-way through being wired has some of the six,
 * and it is still using that directory. The question is whether somebody put
 * something there, not whether they finished.
 */
function holdsABarrel(base: string, dirname: TLankaDiDirname): boolean {
	return lankaDiContract.barrels.some(({ file }) => isFile(`${base}/${dirname}/${file}`));
}

/** A readable entry at that path, whatever it is. */
function isFile(path: string): boolean {
	try {
		return statSync(path).isFile();
	} catch {
		return false;
	}
}

/**
 * A DIRECTORY at that path, not merely something.
 *
 * `.lanka` is a name a consumer might plausibly give a config FILE, and an
 * `existsSync` here would answer yes to it — then resolve the barrels into a
 * file and report every one of them missing, naming the wrong cause.
 */
function isDirectory(path: string): boolean {
	try {
		return statSync(path).isDirectory();
	} catch {
		return false;
	}
}
