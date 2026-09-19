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
	 * Every recognised directory that is actually on disk, preferred first.
	 *
	 * Empty on a project that has not been scaffolded yet. TWO is the case worth
	 * naming: the framework reads one of them and the other is dead wiring that
	 * still type-checks, which is the kind of failure this package exists to turn
	 * into a message.
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
 * 2. otherwise, whatever is on disk, `.lanka` first;
 * 3. otherwise the default, which is what a NEW project gets.
 *
 * Step 2 before step 3 is the whole compatibility story: a project on
 * `.lanka_di` that upgrades is resolved to `.lanka_di`, so the new default never
 * reaches a project that already made a choice. Getting that order backwards
 * would scaffold an empty `.lanka` beside a working `.lanka_di` and start the
 * application against the empty one.
 *
 * ## Both present
 *
 * Reported, never picked around. `found` carries the evidence and
 * `verifyLankaDi` turns it into the message, because only one of the two is
 * read and a consumer editing the other would be editing a file that does
 * nothing — with no error anywhere, since both type-check.
 */
export const resolveLankaDiDir = (
	root: string,
	options: IResolveLankaDiDirOptions = {},
): ILankaDiDir => {
	const base = root.replace(/\\/g, "/").replace(/\/+$/, "");
	const found = lankaDiContract.dirnames.filter((dirname) => isDirectory(`${base}/${dirname}`));
	const dirname = options.dirname ?? found[0] ?? lankaDiContract.dirname;

	return { dirname, path: `${base}/${dirname}`, found };
};

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
