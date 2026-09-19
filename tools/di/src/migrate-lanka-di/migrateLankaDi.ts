import { readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { lankaDiContract } from "../lanka-di-contract/lankaDiContract";
import { resolveLankaDiDir } from "../resolve-lanka-di-dir/resolveLankaDiDir";
import type { TLankaDiDirname } from "../lanka-di-contract/lankaDiContract";

/** What a migration was asked to do. */
export interface IMigrateLankaDiOptions {
	/** The project root, beside its `package.json`. */
	readonly root: string;
	/** The directory to end up with. Defaults to `lankaDiContract.dirname`. */
	readonly to?: TLankaDiDirname;
	/** Decide and report, write nothing. */
	readonly dryRun?: boolean;
}

/** What a migration did, or would have done. */
export interface ILankaDiMigration {
	/** Where the barrels were, or `null` when the project is already where it asked to be. */
	readonly from: TLankaDiDirname | null;
	/** The directory asked for. */
	readonly to: TLankaDiDirname;
	/**
	 * Every step, whether or not it was taken.
	 *
	 * One list rather than a planned one and a done one: a dry run and a real run
	 * must answer the same, or the dry run is not a rehearsal of anything.
	 * `dryRun` says which of the two happened.
	 */
	readonly steps: readonly string[];
	/** Why nothing happened, when nothing did. */
	readonly problems: readonly string[];
	/** Whether anything was written. */
	readonly dryRun: boolean;
}

/**
 * Moves a project between the two legal barrel directories.
 *
 * ## Why this exists rather than a line in a changelog
 *
 * The move is three steps and two of them are invisible. Renaming the directory
 * is the one a person thinks of; the `paths` mapping and the `include` entry in
 * `tsconfig.json` are the two that do not fail when they are wrong — TypeScript's
 * wildcard include skips dot-directories, so a stale include leaves the file that
 * wires the whole application with no types and no error. A migration done by
 * hand is a migration where those two are missed most of the time.
 *
 * ## What it will not do
 *
 * **Merge.** If both directories exist it stops and says so. One of them holds
 * work somebody did, and no rule this tool could apply would tell which.
 *
 * **Reach past the root.** It renames one directory and rewrites the `tsconfig`
 * files beside it — the files the CONTRACT is written in. Walking a consumer's
 * repository for the string would be a tool editing source nobody asked it to
 * touch, and the one time it guessed wrong it would already have done it.
 *
 * **Touch `.gitignore`.** A project ignoring its barrels is a project not
 * committing its own wiring, and carrying that across would carry the defect
 * with it. The CLI says so instead and leaves the decision where it belongs.
 *
 * ## Both directions
 *
 * `.lanka_di` is an alternative, not a deprecation, so this migrates TO it as
 * readily as away from it. A team that prefers the explicit name runs
 * `--to .lanka_di` and gets the same three steps.
 */
export const migrateLankaDi = (options: IMigrateLankaDiOptions): ILankaDiMigration => {
	const { root, dryRun = false } = options;
	const to = options.to ?? lankaDiContract.dirname;
	const { found } = resolveLankaDiDir(root);
	const from = found.find((dirname) => dirname !== to) ?? null;

	const refusal = refuse(found, to);
	if (refusal !== null) return { from, to, steps: [], problems: [refusal], dryRun };

	// Already there. Not a problem and not a no-op worth a step: the project asked
	// for a state it is in, which is the answer somebody runs this to get.
	if (from === null) return { from, to, steps: [], problems: [], dryRun };

	const configs = staleConfigs(root, from);
	const steps = [`${from}/ → ${to}/`, ...configs.map(({ file }) => `${file}: ${from} → ${to}`)];

	if (dryRun) return { from, to, steps, problems: [], dryRun };

	renameSync(join(root, from), join(root, to));
	for (const { file, source } of configs) {
		writeFileSync(join(root, file), source.replace(boundedDir(from), to), "utf8");
	}

	return { from, to, steps, problems: [], dryRun };
};

/**
 * The reason not to proceed, or nothing.
 *
 * Both cases are the same KIND of answer: a state where renaming would make
 * things worse rather than better, and where the person has something to decide
 * that this tool must not decide for them.
 */
const refuse = (found: readonly TLankaDiDirname[], to: TLankaDiDirname): string | null => {
	if (found.length > 1) {
		return (
			`${found.join("/ and ")}/ are both present, so there is nothing to rename — there is ` +
			`a choice to make. Move what you still need into ${to}/ and delete the other: which ` +
			`of the two holds your real wiring is not something this tool can read.`
		);
	}

	if (found.length === 0) {
		return (
			`no barrel directory here — expected ${lankaDiContract.dirnames.join("/ or ")}/ beside ` +
			`package.json. Start the build once and the plugin scaffolds ${to}/, or check that ` +
			`this is the project root.`
		);
	}

	return null;
};

/** A root config that names the old directory, and what it says. */
interface IStaleConfig {
	readonly file: string;
	readonly source: string;
}

/**
 * The `tsconfig` files at the root that still name the old directory.
 *
 * Every `tsconfig*.json`, not just the one: a vite project splits the mapping
 * across `tsconfig.app.json` and `tsconfig.node.json`, and migrating the root
 * one alone leaves the half that actually compiles the application pointing at a
 * directory that is no longer there.
 *
 * It carries the CONTENT out with the name. Reading again at the point of
 * writing would be a second answer to a question already asked — and the branch
 * for "and this time it was not there" is a branch no run can take, which is a
 * line of defence that only ever reports success.
 */
const staleConfigs = (root: string, from: TLankaDiDirname): IStaleConfig[] =>
	readdirSync(root, { withFileTypes: true })
		.filter((entry) => entry.isFile() && /^tsconfig(\..+)?\.json$/.test(entry.name))
		.map((entry) => ({
			file: entry.name,
			source: readFileSync(join(root, entry.name), "utf8"),
		}))
		.filter(({ source }) => boundedDir(from).test(source))
		.sort((a, b) => a.file.localeCompare(b.file));

/**
 * The directory name as a whole segment, never as a substring.
 *
 * `.lanka` is a PREFIX of `.lanka_di`. Without the boundary, a project already
 * on `.lanka_di` reads as one that names `.lanka`, and the replace above turns
 * `.lanka_di/*` into `.lanka_di_di/*` on every line that was already correct.
 * The boundary is "not followed by a word character or a dash", which is every
 * character a path segment may end at.
 *
 * A FRESH regex each call: the `g` flag makes `test` stateful, and a shared one
 * would answer differently on alternate calls for reasons nothing in the caller
 * could explain.
 */
const boundedDir = (dirname: TLankaDiDirname): RegExp =>
	new RegExp(`${dirname.replace(/\./g, "\\.")}(?![\\w-])`, "g");
