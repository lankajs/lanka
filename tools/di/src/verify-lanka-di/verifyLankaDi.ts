import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { lankaDiBridge } from "../lanka-di-bridge/lankaDiBridge";
import { lankaDiContract } from "../lanka-di-contract/lankaDiContract";
import { lankaDiExportedNames } from "../lanka-di-exported-names/lankaDiExportedNames";
import { otherLankaDiDirname } from "../_utils/other-lanka-di-dirname/otherLankaDiDirname";
import { resolveLankaDiDir } from "../resolve-lanka-di-dir/resolveLankaDiDir";
import { resolveLankaDiShards } from "../resolve-lanka-di-shards/resolveLankaDiShards";
import { withoutCommentedLines } from "../_utils/without-commented-lines/withoutCommentedLines";
import type { ILankaDiShard } from "../resolve-lanka-di-shards/resolveLankaDiShards";
import type { TLankaDiDirname } from "../lanka-di-contract/lankaDiContract";

export interface ILankaDiReport {
	/** Absolute path of the directory the alias points at. */
	readonly dir: string;
	/**
	 * Its name, relative to the root — `.lanka` or `.lanka_di`.
	 *
	 * Reported rather than assumed: everything this report says names a path, and
	 * a reader who has to work out which of the two layouts was checked is a
	 * reader who will guess wrong on the project that has both.
	 */
	readonly dirname: TLankaDiDirname;
	/**
	 * Every directory this project actually keeps barrels IN, `dirname` first.
	 *
	 * One entry for almost every project. Two for one that splits its wiring, and
	 * the second is not a mistake — it is a layout, and this is where a caller
	 * reads it rather than inferring it from a path.
	 *
	 * Named for what it means rather than for what it holds, because this package
	 * already has two lists of directory names and a third called `dirnames`
	 * would be indistinguishable from them: `lankaDiContract.dirnames` is every
	 * name that is LEGAL, `resolveLankaDiDir().found` is every name on DISK, and
	 * this is the subset of those a barrel is actually in. An empty directory
	 * appears in the second and not in this one.
	 */
	readonly directoriesInUse: readonly TLankaDiDirname[];
	/** What this run wrote, relative to the consumer root. Empty on a healthy project. */
	readonly created: readonly string[];
	/**
	 * Everything wrong that scaffolding cannot fix.
	 *
	 * A missing file is not a problem — it gets written. A file that exists and
	 * does not export what the framework calls by name IS one: overwriting a
	 * consumer's own code to satisfy a contract destroys their work.
	 */
	readonly problems: readonly string[];
}

/** Every export form a name can leave through. */
const exportsName = (source: string, name: string): boolean => {
	const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const declared = new RegExp(`export\\s+(?:const|let|var|function|class)\\s+${escaped}\\b`);
	const listed = new RegExp(`export\\s*\\{[^}]*\\b${escaped}\\b[^}]*\\}`);
	return declared.test(source) || listed.test(source);
};

const tsconfigProblems = (root: string, inUse: readonly TLankaDiDirname[]): string[] => {
	const path = join(root, "tsconfig.json");
	if (!existsSync(path)) return [];

	const source = withoutCommentedLines(readFileSync(path, "utf8"));
	const problems: string[] = [];
	const [primary] = inUse;

	if (!source.includes(`"${lankaDiContract.alias}/*"`)) {
		problems.push(
			`tsconfig.json has no "${lankaDiContract.alias}/*" path mapping. Add it under compilerOptions.paths:\n` +
				`      "${lankaDiContract.alias}/*": ["${primary}/*"]`,
		);
	}

	// TypeScript's wildcard include skips dot-directories: `src/**/*` never
	// reaches the barrels however broad it looks, and neither does the DEFAULT
	// include, which is the same pattern. Without an explicit entry the barrels
	// compile only because something imports them: no `noUnusedLocals`, no
	// `strict`, no editor errors — in the one file that wires the whole app.
	//
	// The `include` ARRAY is read, not the whole file: `compilerOptions.paths`
	// also mentions the directory, so a substring search over the whole
	// `tsconfig` finds that mapping and declares the include present.
	//
	// Every directory in use, not only the one the alias points at. A shard the
	// include misses is typed only because the bridge imports it, which means the
	// day somebody removes the bridge they lose the types and the wiring at once
	// and are told about neither.
	const include = /"include"\s*:\s*\[[^\]]*\]/.exec(source)?.[0] ?? "";

	for (const dirname of inUse) {
		if (namesDir(include, dirname)) continue;

		problems.push(
			`tsconfig.json does not include "${dirname}". A wildcard include skips dot-directories, so add it explicitly:\n` +
				`      "${dirname}/**/*"`,
		);
	}

	return problems;
};

/**
 * The directory name, as a whole segment rather than as a substring.
 *
 * `.lanka` occurs inside `.lanka_di`, so `includes` answers yes to the wrong
 * layout in one of the two directions and the check goes quiet for exactly the
 * project that changed its mind.
 */
const namesDir = (source: string, dirname: TLankaDiDirname): boolean =>
	new RegExp(`${dirname.replace(/\./g, "\\.")}(?![\\w-])`).test(source);

/**
 * Compares the barrels' contract version with the one the framework reads.
 *
 * A problem rather than a warning: "file present, export present, different
 * semantics" passes every shape check and shows up as behaviour.
 *
 * A mismatch in EITHER direction: barrels older than the framework do not
 * describe what it will ask for; a framework older than the barrels will not
 * understand what they give. An unreadable value is a problem too — accepting it
 * returns to exactly the state the version exists to prevent.
 *
 * Read from wherever the number IS. A project whose primary `Contract.ts` is a
 * bridge keeps its version in the other directory, and demanding a literal in
 * the file the alias happens to point at would report every such project as
 * unreadable.
 */
const contractVersionProblems = (
	root: string,
	shard: ILankaDiShard | undefined,
	inUse: readonly TLankaDiDirname[],
): string[] => {
	if (shard === undefined || shard.holders.length === 0) return [];

	const declared = shard.holders
		.map((dirname) => ({
			dirname,
			version: declaredVersion(readFileSync(join(root, dirname, shard.barrel.file), "utf8")),
		}))
		.filter((one) => one.version !== null);

	if (declared.length === 0) {
		// Named at the file that SHOULD carry the number, which on a split project
		// is not the one the alias resolves to. A bridge correctly has no version
		// in it, and pointing somebody at the one file that is right about this is
		// how a message sends a reader to fix the wrong thing.
		const where = shard.holders[shard.bridged ? shard.holders.length - 1 : 0];

		return [
			`${where}/${shard.barrel.file}: the contract version is unreadable. Expected ` +
				`export const lankaDiContractVersion = ${String(lankaDiContract.version)};`,
		];
	}

	return declared
		.filter((one) => one.version !== lankaDiContract.version)
		.map(
			(one) =>
				`${one.dirname}: contract version ${String(one.version)}, the framework reads ` +
				`${String(lankaDiContract.version)}. The barrels and the framework describe ` +
				`different things — update the barrels to the new contract, or the framework ` +
				`to a version that knows yours.` +
				(inUse.length > 1
					? ` Both directories are in use; this is the one that says so.`
					: ""),
		);
};

/** The number a `Contract.ts` states, or nothing when it states none. */
const declaredVersion = (source: string): number | null => {
	const match = /lankaDiContractVersion\s*(?::[^=]*)?=\s*(\d+)/.exec(source);
	return match === null ? null : Number(match[1]);
};

/** What one barrel's check needs to know. */
interface IVisit {
	readonly shard: ILankaDiShard;
	readonly root: string;
	readonly primary: TLankaDiDirname;
	readonly secondary: TLankaDiDirname;
	readonly scaffold: boolean;
	readonly created: string[];
	readonly problems: string[];
}

/**
 * One barrel, checked and if necessary written.
 *
 * The three outcomes are the point. A MISSING file is `created`. A WRONG one is
 * a `problem`, because repairing it would mean overwriting a consumer's own code
 * to satisfy a contract. A file that is missing only from the PRIMARY, while the
 * other directory holds it, is a third case this package did not have until
 * sharding: it is written, but what is written is a bridge rather than a stub,
 * because a stub there would shadow the consumer's real barrel with an empty one.
 */
const visitBarrel = (visit: IVisit): void => {
	const { shard, primary } = visit;

	if (shard.holders.length === 0) return scaffoldStub(visit);
	if (!shard.holders.includes(primary)) return scaffoldBridge(visit);

	// The two barrel classes are checked by two rules and never by both. A barrel
	// the framework reads BY NAME is one value wherever it lives; a namespace
	// barrel is a list that may have halves. Running both over a value barrel is
	// how this package spent a morning condemning the bridge it had just written.
	const { requiredExport } = shard.barrel;
	if (requiredExport !== null) return checkRequiredExport(visit, requiredExport);

	if (shard.holders.length > 1) checkShard(visit);
};

/** Nowhere yet: the ordinary first run, which writes the contract's own stub. */
const scaffoldStub = ({ shard, root, primary, scaffold, created, problems }: IVisit): void => {
	const where = `${primary}/${shard.barrel.file}`;

	if (!scaffold) {
		problems.push(`${where} is missing.`);
		return;
	}

	writeFileSync(join(root, primary, shard.barrel.file), shard.barrel.stub, "utf8");
	created.push(where);
};

/**
 * In the other directory only: the primary gets a bridge to it.
 *
 * This is what makes "gateways over there, host over here" work without the
 * consumer configuring anything. The alias resolves to the primary, so the
 * primary has to answer for every barrel — and the honest way to answer for one
 * that lives elsewhere is a line saying where.
 */
const scaffoldBridge = ({
	shard,
	root,
	primary,
	secondary,
	scaffold,
	created,
	problems,
}: IVisit): void => {
	const line = lankaDiBridge(secondary, shard.barrel.file);
	const where = `${primary}/${shard.barrel.file}`;

	if (!scaffold) {
		problems.push(
			`${where} is missing, and ${secondary}/${shard.barrel.file} exists. ` +
				`${lankaDiContract.alias}/${shard.barrel.file.replace(/\.ts$/, "")} resolves to ` +
				`${primary}/, so that is where the framework looks. Add the file with one line:\n` +
				`      ${line}`,
		);
		return;
	}

	writeFileSync(join(root, primary, shard.barrel.file), `${BRIDGE_HEADER}${line}\n`, "utf8");
	created.push(where);
};

/**
 * What a written bridge says about itself.
 *
 * A file a tool wrote into a consumer's repository, holding one line they did
 * not type, has to explain itself where they will read it. They may add their
 * own exports below it, and nothing here will touch the file again.
 */
const BRIDGE_HEADER =
	`/**\n * This barrel reaches into the other barrel directory.\n *\n` +
	` * The alias resolves HERE, so this file is what the framework reads — and the\n` +
	` * line below is how it says that the rest of this barrel is next door.\n *\n` +
	` * Written once by \`@lankajs/tool-di\`. Add your own exports below; nothing\n` +
	` * rewrites this file, and removing the line removes what it reaches.\n */\n`;

/**
 * A barrel the framework reads BY NAME: exactly one declaration, reachable.
 *
 * `Host.ts` and `Contract.ts` hold one value each, so they may live in either
 * directory — "the gateways over there, the host over here" is the whole point —
 * but they may not be SPLIT, because there is no union of two hosts.
 *
 * Counted by DECLARATION and never by file. Two files is the ordinary shape of
 * this layout: the one that declares the value, and the one the alias resolves
 * to, holding the line that reaches it. A rule that counted files condemned the
 * bridge this package had written itself, on every build after the first, with a
 * message telling the reader to delete one of the two — and the one it called
 * dead wiring was the one holding their host.
 */
const checkRequiredExport = (
	{ shard, root, primary, secondary, problems }: IVisit,
	requiredExport: string,
): void => {
	const { file } = shard.barrel;

	const declaredIn = shard.holders.filter((dirname) =>
		exportsName(readFileSync(join(root, dirname, file), "utf8"), requiredExport),
	);

	if (declaredIn.length > 1) {
		problems.push(
			`${primary}/${file} and ${secondary}/${file} both declare \`${requiredExport}\`, and this ` +
				`barrel is a single value, not a list. lanka reads ${primary}/${file} and the other ` +
				`is dead wiring that still type-checks. Keep one.`,
		);
		return;
	}

	// Declared next door and reached from here is the layout working. Declared
	// next door and NOT reached is the one case this barrel class shares with a
	// shard: the value exists, and the file the framework opens does not mention
	// it.
	if (declaredIn.length === 1 && (declaredIn[0] === primary || shard.bridged)) return;

	if (declaredIn[0] === secondary) {
		problems.push(
			`${secondary}/${file} declares \`${requiredExport}\` and ${primary}/${file} does not ` +
				`reach it, so the framework reads a file that does not have it. One line in ` +
				`${primary}/${file}:\n      ${lankaDiBridge(secondary, file)}`,
		);
		return;
	}

	problems.push(
		`${primary}/${file} exists but does not export \`${requiredExport}\`, which lanka reads by name.` +
			(shard.holders.includes(secondary) ? ` Neither does ${secondary}/${file}.` : ""),
	);
};

/**
 * Both directories hold a NAMESPACE barrel: two halves of one list.
 *
 * Only this class reaches here. A barrel the framework reads by name is one
 * value and `checkRequiredExport` owns it; the question for a list is the two
 * this asks — whether the halves are joined, and whether joining them loses a
 * name.
 *
 * The routing costs a value barrel its collision check, and that is correct
 * rather than overlooked: the only name that could collide there is the one the
 * framework reads, and counting its DECLARATIONS is a stricter test than
 * comparing export lists would be.
 */
const checkShard = (visit: IVisit): void => {
	const { shard, root, primary, secondary, problems } = visit;
	const { file } = shard.barrel;

	if (!shard.bridged) {
		problems.push(
			`${secondary}/${file} exists and ${primary}/${file} does not re-export it, so nothing ` +
				`the framework reads can see it. Sharding a barrel across both directories is ` +
				`supported; joining them is one line in ${primary}/${file}:\n` +
				`      ${lankaDiBridge(secondary, file)}`,
		);
		return;
	}

	problems.push(...collisions(root, shard, primary, secondary));
};

/**
 * A name both halves of a sharded barrel export.
 *
 * The one failure sharding adds, and the reason this check exists at all: ESM
 * resolves an ambiguous star export by DROPPING the name. No build error, no
 * type error — the gateway is simply not in the locator, and the first thing
 * anybody suspects is the framework.
 */
const collisions = (
	root: string,
	shard: ILankaDiShard,
	primary: TLankaDiDirname,
	secondary: TLankaDiDirname,
): string[] => {
	const { file } = shard.barrel;
	const here = lankaDiExportedNames(readFileSync(join(root, primary, file), "utf8"));
	const there = new Set(lankaDiExportedNames(readFileSync(join(root, secondary, file), "utf8")));
	const both = [...new Set(here.filter((name) => there.has(name)))];

	if (both.length === 0) return [];

	return [
		`${primary}/${file} and ${secondary}/${file} both export ${both.map((one) => `\`${one}\``).join(", ")}. ` +
			`A star re-export resolves an ambiguous name by dropping it, so ` +
			`${both.length === 1 ? "that name is" : "those names are"} in neither — with no error ` +
			`anywhere. Export each name from one side only.`,
	];
};

/**
 * Why the directory cannot be used as it stands, or nothing.
 *
 * Both answers are the same KIND: a state where writing barrels would make
 * things worse rather than better. `migrateLankaDi`'s `refuse` is the same shape
 * for the same reason.
 *
 * The first is the one that bites. `existsSync` alone says yes to a FILE — and
 * `.lanka` is a name somebody may well have given a config file of their own —
 * so the directory would never be created and the first barrel write would fail
 * with a raw ENOENT naming a path INSIDE a file. That is the confusing failure
 * this package exists to replace, arriving from the package itself.
 */
const unusable = (dir: string, dirname: TLankaDiDirname, scaffold: boolean): string | null => {
	if (existsSync(dir)) {
		if (statSync(dir).isDirectory()) return null;

		return (
			`${dirname} is a file, not a directory. lanka publishes its barrels in ` +
			`${dirname}/ — move your file out of the way, or use ` +
			`${otherLankaDiDirname(dirname)}/ instead, which this framework reads just as well.`
		);
	}

	if (!scaffold) return `${dirname}/ is missing. Run with scaffold enabled, or create it.`;

	return null;
};

/** What the caller may decide about a run. */
export interface IVerifyLankaDiOptions {
	/** Write missing barrels instead of reporting them. On by default. */
	readonly scaffold?: boolean;
	/**
	 * Check THIS directory rather than the one the project turns out to have.
	 *
	 * Optional, and absent means the previous behaviour for every project that
	 * already has barrels: `resolveLankaDiDir` finds them where they are. It
	 * decides one case — a project with no directory at all, which gets the
	 * default.
	 *
	 * On a project using BOTH, this names the one the alias points at — the
	 * primary — and the other is read as its shards.
	 */
	readonly dirname?: TLankaDiDirname;
}

/**
 * Checks the consumer's barrels and, when allowed, writes what is missing.
 *
 * Which directory the alias points at comes from `resolveLankaDiDir`, not from a
 * constant: `.lanka` and `.lanka_di` are both legal, and the project on disk is
 * the only thing that knows which one it uses.
 *
 * ## One project, two directories
 *
 * Supported, and not as a migration state. A project may split by ABSTRACTION —
 * its gateways in one directory, its host in the other — or by SHARD, half its
 * gateways in each, and neither split means anything to the framework. The axis
 * belongs to the team.
 *
 * What the framework needs is that one file answers for each barrel, because the
 * alias resolves to one path. So the primary answers for all six, and a barrel
 * whose other half is next door says so with a re-export. This writes that line
 * when the file is missing entirely, and reports it — never edits — when the
 * consumer's own file is the one that would have to change.
 *
 * Free of any vite type on purpose: the plugin is a thin caller, and this can be
 * run from a CLI, a test or a postinstall without pulling in a bundler.
 */
export function verifyLankaDi(root: string, options: IVerifyLankaDiOptions = {}): ILankaDiReport {
	const scaffold = options.scaffold ?? true;
	const primary = resolveLankaDiDir(root, { dirname: options.dirname }).dirname;
	const secondary = otherLankaDiDirname(primary);
	const dir = join(root, primary);
	const created: string[] = [];
	const problems: string[] = [];

	// Read BEFORE the refusal, so the report is true on the path a caller reads
	// when something is wrong. A refusal that claimed one directory while the
	// other held every barrel would be a wrong answer in the one report somebody
	// is already reading because they are confused.
	const shards = resolveLankaDiShards(root, primary);
	const directoriesInUse = barrelDirectoriesIn(shards, primary, secondary);

	const refusal = unusable(dir, primary, scaffold);
	if (refusal !== null) {
		return { dir, dirname: primary, directoriesInUse, created, problems: [refusal] };
	}

	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
		created.push(`${primary}/`);
	}

	for (const shard of shards) {
		visitBarrel({ shard, root, primary, secondary, scaffold, created, problems });
	}

	problems.push(
		...contractVersionProblems(
			root,
			shards.find((one) => one.barrel.requiredExport === "lankaDiContractVersion"),
			directoriesInUse,
		),
	);
	problems.push(...tsconfigProblems(root, directoriesInUse));

	return { dir, dirname: primary, directoriesInUse, created, problems };
}

/**
 * The directories this project keeps barrels in, primary first.
 *
 * Read from the BARRELS rather than from the directories on disk. An empty
 * second directory — left behind by a migration, or made by an editor that
 * creates a folder before anything is in it — is not a layout, and a project
 * should not be told to add it to its `tsconfig` because a stray folder exists.
 */
const barrelDirectoriesIn = (
	shards: readonly ILankaDiShard[],
	primary: TLankaDiDirname,
	secondary: TLankaDiDirname,
): readonly TLankaDiDirname[] =>
	shards.some((shard) => shard.holders.includes(secondary)) ? [primary, secondary] : [primary];
