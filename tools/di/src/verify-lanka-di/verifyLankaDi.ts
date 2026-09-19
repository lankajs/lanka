import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { lankaDiContract } from "../lanka-di-contract/lankaDiContract";
import { resolveLankaDiDir } from "../resolve-lanka-di-dir/resolveLankaDiDir";
import type { ILankaBarrelSpec, TLankaDiDirname } from "../lanka-di-contract/lankaDiContract";

export interface ILankaDiReport {
	/** Absolute path of the directory that was checked. */
	readonly dir: string;
	/**
	 * Its name, relative to the root — `.lanka` or `.lanka_di`.
	 *
	 * Reported rather than assumed: everything this report says names a path, and
	 * a reader who has to work out which of the two layouts was checked is a
	 * reader who will guess wrong on the project that has both.
	 */
	readonly dirname: TLankaDiDirname;
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

/**
 * Drops commented-out `tsconfig` lines so a disabled mapping does not read as a
 * live one.
 *
 * LINE-oriented, and that is the whole point. A block-comment regex is wrong
 * here: the strings inspected are globs, and a recursive include pattern
 * contains a slash-star and a star-slash in the middle. A block regex treats
 * that as a comment, eats the middle of every include pattern and reports the
 * include as missing.
 *
 * A commented-out entry always occupies its own line in a formatted `tsconfig`,
 * which is the only case that has to be understood.
 */
const withoutCommentedLines = (source: string): string =>
	source
		.split("\n")
		.filter((line) => {
			const trimmed = line.trim();
			return (
				!trimmed.startsWith("//") && !trimmed.startsWith("/*") && !trimmed.startsWith("*")
			);
		})
		.join("\n");

const tsconfigProblems = (root: string, dirname: TLankaDiDirname): string[] => {
	const path = join(root, "tsconfig.json");
	if (!existsSync(path)) return [];

	const source = withoutCommentedLines(readFileSync(path, "utf8"));
	const problems: string[] = [];

	if (!source.includes(`"${lankaDiContract.alias}/*"`)) {
		problems.push(
			`tsconfig.json has no "${lankaDiContract.alias}/*" path mapping. Add it under compilerOptions.paths:\n` +
				`      "${lankaDiContract.alias}/*": ["${dirname}/*"]`,
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
	// The name is matched with a boundary, because `.lanka` is a PREFIX of
	// `.lanka_di`: a project on `.lanka` whose include still says `.lanka_di/**/*`
	// would otherwise pass on a substring, and its barrels would stay untyped —
	// which is the exact failure this check exists for.
	const include = /"include"\s*:\s*\[[^\]]*\]/.exec(source)?.[0] ?? "";
	if (!namesDir(include, dirname)) {
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
 * Both directories on disk, which is one too many.
 *
 * Neither name is wrong and neither is deprecated — having BOTH is, because the
 * framework reads one and the other keeps type-checking. A consumer adding a
 * gateway to the wrong file gets no error anywhere: the export is valid, the
 * file compiles, and the locator simply never sees it.
 *
 * Reported rather than resolved. Deleting one is a choice about which half of
 * somebody's wiring is the real one, and this tool does not overwrite a
 * consumer's code to satisfy a contract.
 */
const ambiguityProblems = (found: readonly TLankaDiDirname[]): string[] => {
	if (found.length < 2) return [];

	return [
		`${found.join("/ and ")}/ are both present. lanka reads ${found[0]}/ and the other is dead ` +
			`wiring that still type-checks — a gateway added to it is never seen and never ` +
			`reported. Move whatever you still need into ${found[0]}/ and delete the other; ` +
			`this tool will not choose for you, because one of them is somebody's work.`,
	];
};

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
 */
function contractVersionProblems(dir: string, dirname: TLankaDiDirname): string[] {
	const file = join(dir, "Contract.ts");
	if (!existsSync(file)) return [];

	const source = readFileSync(file, "utf8");
	const match = /lankaDiContractVersion\s*(?::[^=]*)?=\s*(\d+)/.exec(source);

	if (!match) {
		return [
			`${dirname}/Contract.ts: the contract version is unreadable. Expected ` +
				`export const lankaDiContractVersion = ${String(lankaDiContract.version)};`,
		];
	}

	const declared = Number(match[1]);
	if (declared === lankaDiContract.version) return [];

	return [
		`${dirname}: contract version ${String(declared)}, the framework reads ` +
			`${String(lankaDiContract.version)}. The barrels and the framework describe ` +
			`different things — update the barrels to the new contract, or the framework ` +
			`to a version that knows yours.`,
	];
}

/**
 * One barrel, checked and if necessary written.
 *
 * The two lists are the point: a MISSING file is `created`, a WRONG one is a
 * `problem`. Collapsing them would mean repairing the second by overwriting,
 * which destroys a consumer's own code to satisfy a contract.
 */
const visitBarrel = (visit: {
	barrel: ILankaBarrelSpec;
	dir: string;
	dirname: TLankaDiDirname;
	scaffold: boolean;
	created: string[];
	problems: string[];
}): void => {
	const { barrel, dir, dirname, scaffold, created, problems } = visit;
	const file = join(dir, barrel.file);

	if (!existsSync(file)) {
		if (!scaffold) {
			problems.push(`${dirname}/${barrel.file} is missing.`);
			return;
		}
		writeFileSync(file, barrel.stub, "utf8");
		created.push(`${dirname}/${barrel.file}`);
		return;
	}

	if (barrel.requiredExport && !exportsName(readFileSync(file, "utf8"), barrel.requiredExport)) {
		problems.push(
			`${dirname}/${barrel.file} exists but does not export \`${barrel.requiredExport}\`, which lanka reads by name.`,
		);
	}
};

/**
 * The other legal name, for a message that has somewhere to send the reader.
 *
 * A consumer whose `.lanka` is already their own file is not stuck: the second
 * directory is equally correct and equally supported, which is the whole reason
 * this package reads two.
 */
const otherDirname = (dirname: TLankaDiDirname): TLankaDiDirname => {
	const [first, second] = lankaDiContract.dirnames;
	return dirname === first ? second : first;
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
			`${otherDirname(dirname)}/ instead, which this framework reads just as well.`
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
	 */
	readonly dirname?: TLankaDiDirname;
}

/**
 * Checks the consumer's barrel directory and, when allowed, writes what is
 * missing.
 *
 * Which directory that is comes from `resolveLankaDiDir`, not from a constant:
 * `.lanka` and `.lanka_di` are both legal, and the project on disk is the only
 * thing that knows which one it uses.
 *
 * Free of any vite type on purpose: the plugin is a thin caller, and this can be
 * run from a CLI, a test or a postinstall without pulling in a bundler.
 */
export function verifyLankaDi(root: string, options: IVerifyLankaDiOptions = {}): ILankaDiReport {
	const scaffold = options.scaffold ?? true;
	const resolved = resolveLankaDiDir(root, { dirname: options.dirname });
	const { dirname } = resolved;
	const dir = join(root, dirname);
	const created: string[] = [];
	const problems: string[] = [...ambiguityProblems(resolved.found)];

	const refusal = unusable(dir, dirname, scaffold);
	if (refusal !== null) {
		return { dir, dirname, created, problems: [...problems, refusal] };
	}

	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
		created.push(`${dirname}/`);
	}

	for (const barrel of lankaDiContract.barrels) {
		visitBarrel({ barrel, dir, dirname, scaffold, created, problems });
	}

	problems.push(...contractVersionProblems(dir, dirname));
	problems.push(...tsconfigProblems(root, dirname));

	return { dir, dirname, created, problems };
}
