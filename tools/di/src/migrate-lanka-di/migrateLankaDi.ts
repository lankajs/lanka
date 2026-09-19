import {
	readFileSync,
	readdirSync,
	renameSync,
	rmdirSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { lankaDiContract } from "../lanka-di-contract/lankaDiContract";
import { lankaDiExportedNames } from "../lanka-di-exported-names/lankaDiExportedNames";
import { resolveLankaDiDir } from "../resolve-lanka-di-dir/resolveLankaDiDir";
import { resolveLankaDiShards } from "../resolve-lanka-di-shards/resolveLankaDiShards";
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
 * Brings a project's barrels into ONE directory.
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
 * ## Two directories are a layout, and this is how a project leaves it
 *
 * A project may keep barrels in both on purpose — `verifyLankaDi` supports it,
 * and nothing nags a project that does. This command is for the one that has
 * decided to stop: it MERGES, moving each barrel the other directory holds into
 * the one asked for.
 *
 * It merges only what it can do without writing anybody's code. A barrel both
 * directories hold with exports on each side is two halves of one list, and
 * joining them means choosing an order and an arrangement inside a file somebody
 * wrote — so that is refused, named file by file. A destination file that
 * exports nothing of its own is not work: the bridge written for a sharded
 * barrel and the stub written for an empty one both stand aside for the real
 * file rather than counting as a conflict.
 *
 * ## What it will not do
 *
 * **Reach past the root.** It moves barrels and rewrites the `tsconfig` files
 * beside them — the files the CONTRACT is written in. Walking a consumer's
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
 * `--to .lanka_di` and gets the same steps.
 */
export const migrateLankaDi = (options: IMigrateLankaDiOptions): ILankaDiMigration => {
	const { root, dryRun = false } = options;
	const to = options.to ?? lankaDiContract.dirname;
	const { found } = resolveLankaDiDir(root);
	const from = found.find((dirname) => dirname !== to) ?? null;

	if (found.length === 0) return { from, to, steps: [], problems: [nothingHere(to)], dryRun };
	if (from === null) {
		// Already there. Not a problem and not a no-op worth a step: the project
		// asked for a state it is in, which is the answer somebody runs this to get.
		return { from, to, steps: [], problems: [], dryRun };
	}

	return found.includes(to)
		? merge({ root, from, to, dryRun })
		: rename({ root, from, to, dryRun });
};

/** Nothing to move, and the two reasons that can be true. */
const nothingHere = (to: TLankaDiDirname): string =>
	`no barrel directory here — expected ${lankaDiContract.dirnames.join("/ or ")}/ beside ` +
	`package.json. Start the build once and the plugin scaffolds ${to}/, or check that ` +
	`this is the project root.`;

/** What every path through this file needs. */
interface IMove {
	readonly root: string;
	readonly from: TLankaDiDirname;
	readonly to: TLankaDiDirname;
	readonly dryRun: boolean;
}

/**
 * One directory, under the other name.
 *
 * The simple case, and the only one before two directories at once became a
 * layout: the whole directory is renamed and the configs that named it follow.
 */
const rename = ({ root, from, to, dryRun }: IMove): ILankaDiMigration => {
	const configs = staleConfigs(root, from);
	const steps = [`${from}/ → ${to}/`, ...configs.map(({ file }) => `${file}: ${from} → ${to}`)];

	if (dryRun) return { from, to, steps, problems: [], dryRun };

	renameSync(join(root, from), join(root, to));
	writeConfigs(root, configs, from, to);

	return { from, to, steps, problems: [], dryRun };
};

/**
 * Two directories into one, file by file.
 *
 * Whole-file moves only. Every barrel that would need its CONTENTS merged is
 * reported instead, and nothing is written at all when there is even one — a
 * half-done merge is worse than a refused one, because the reader cannot tell
 * which half happened.
 */
const merge = ({ root, from, to, dryRun }: IMove): ILankaDiMigration => {
	const strays = straysIn(root, from);
	if (strays.length > 0)
		return { from, to, steps: [], problems: [strayFiles(from, strays)], dryRun };

	const moves = plan(root, from, to);
	const conflicts = moves.filter((one) => one.conflict);

	if (conflicts.length > 0) {
		return {
			from,
			to,
			steps: [],
			problems: conflicts.map((one) => conflict(one.file, from, to)),
			dryRun,
		};
	}

	const configs = staleConfigs(root, from);
	const steps = mergeSteps(moves, configs, from, to);

	if (dryRun) return { from, to, steps, problems: [], dryRun };

	applyMoves(root, moves, from, to);
	rmdirSync(join(root, from));
	writeConfigs(root, configs, from, to);

	return { from, to, steps, problems: [], dryRun };
};

/**
 * What the merge will do, in the order it will do it.
 *
 * Built once and returned whether or not anything is written, because a dry run
 * that reported a different list would not be a rehearsal of anything.
 */
const mergeSteps = (
	moves: readonly IPlannedMove[],
	configs: readonly IStaleConfig[],
	from: TLankaDiDirname,
	to: TLankaDiDirname,
): string[] => [
	...moves.map((one) =>
		one.drops
			? `${from}/${one.file} removed — it carried nothing ${to}/${one.file} does not`
			: `${from}/${one.file} → ${to}/${one.file}`,
	),
	`${from}/ removed`,
	...configs.map(({ file }) => `${file}: ${from} dropped`),
];

/**
 * The three fates, carried out.
 *
 * The order inside one barrel matters: a destination that carries nothing of its
 * own is removed BEFORE the source lands on it, because a rename onto an
 * existing file is not portable and a rename onto a directory is not a rename.
 */
const applyMoves = (
	root: string,
	moves: readonly IPlannedMove[],
	from: TLankaDiDirname,
	to: TLankaDiDirname,
): void => {
	for (const one of moves) {
		if (one.drops) {
			unlinkSync(join(root, from, one.file));
			continue;
		}

		if (one.replaces) unlinkSync(join(root, to, one.file));
		renameSync(join(root, from, one.file), join(root, to, one.file));
	}
};

/** One barrel's fate in a merge. */
interface IPlannedMove {
	readonly file: string;
	/** The destination holds a file that carries nothing of its own, which the move replaces. */
	readonly replaces: boolean;
	/** The SOURCE carries nothing of its own: there is nothing to move, only to remove. */
	readonly drops: boolean;
	/** Both sides hold exports of their own, which this tool will not join. */
	readonly conflict: boolean;
}

/**
 * What moving each barrel would mean.
 *
 * The two middle cases are why this is a plan and not a loop of renames. A file
 * that exports nothing of its OWN carries no work: it is the bridge this package
 * writes for a sharded barrel, or the empty stub it writes for a barrel nobody
 * has filled in yet. Treating one as a conflict would refuse every merge of a
 * project that has been built once — which is every project.
 *
 * Which SIDE is empty decides what happens. An empty destination stands aside
 * for the real file; an empty source is removed rather than moved, because a
 * bridge that lands on top of the barrel it was pointing at deletes the wiring
 * it existed to reach. The direction of a merge is the caller's to choose, and
 * both directions meet both cases.
 *
 * What it will not do is join two lists. Both sides exporting names means
 * deciding an order and an arrangement inside a file somebody wrote, and a tool
 * that guessed would have already done it by the time they disagreed.
 */
const plan = (root: string, from: TLankaDiDirname, to: TLankaDiDirname): IPlannedMove[] =>
	resolveLankaDiShards(root, to)
		.filter((shard) => shard.holders.includes(from))
		.map((shard) => {
			const file = shard.barrel.file;
			const fate = { file, replaces: false, drops: false, conflict: false };

			if (!shard.holders.includes(to)) return fate;

			const here = lankaDiExportedNames(readFileSync(join(root, from, file), "utf8"));
			if (here.length === 0) return { ...fate, drops: true };

			const there = lankaDiExportedNames(readFileSync(join(root, to, file), "utf8"));

			return there.length === 0 ? { ...fate, replaces: true } : { ...fate, conflict: true };
		});

const conflict = (file: string, from: TLankaDiDirname, to: TLankaDiDirname): string =>
	`${to}/${file} has exports of its own, and so does ${from}/${file}. Joining them means ` +
	`deciding the order and the arrangement inside a file you wrote, which this tool will ` +
	`not do for you. Move the lines yourself, then run this again.`;

/** Anything in the directory being emptied that is not a barrel. */
const straysIn = (root: string, from: TLankaDiDirname): string[] => {
	const barrels = new Set(lankaDiContract.barrels.map((one) => one.file));

	return readdirSync(join(root, from), { withFileTypes: true })
		.filter((entry) => !(entry.isFile() && barrels.has(entry.name)))
		.map((entry) => entry.name)
		.sort((a, b) => a.localeCompare(b));
};

const strayFiles = (from: TLankaDiDirname, strays: readonly string[]): string =>
	`${from}/ holds ${strays.join(", ")}, which ${lankaDiContract.alias} knows nothing about. ` +
	`This command moves barrels and removes the directory, and removing a directory with ` +
	`somebody's own files in it is not a migration. Move them out first.`;

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

const writeConfigs = (
	root: string,
	configs: readonly IStaleConfig[],
	from: TLankaDiDirname,
	to: TLankaDiDirname,
): void => {
	for (const { file, source } of configs) {
		writeFileSync(join(root, file), deduplicated(source.replace(boundedDir(from), to)), "utf8");
	}
};

/**
 * The same string literal twice in a row, collapsed to once.
 *
 * A project that used both directories named both in its `include` and both in
 * its `paths`. Renaming one onto the other leaves the entry written twice, which
 * TypeScript accepts and a reader does not — and a reader who deletes what looks
 * like a stray duplicate is the person this tool is trying not to create.
 *
 * Adjacent literals only, separated by at most a comma and whitespace. Two equal
 * entries somewhere else in the file are two different settings that happen to
 * read the same, and collapsing those would be editing a config nobody asked
 * about.
 */
const deduplicated = (source: string): string => {
	let out = source;
	let previous = "";

	while (out !== previous) {
		previous = out;
		out = out.replace(/("(?:[^"\\]|\\.)*")(\s*),\s*\1/g, "$1");
	}

	return out;
};

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
