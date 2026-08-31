import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { lankaDiContract } from "../lanka-di-contract/lankaDiContract";

export interface ILankaDiReport {
	/** Absolute path of the directory that was checked. */
	readonly dir: string;
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

const tsconfigProblems = (root: string): string[] => {
	const path = join(root, "tsconfig.json");
	if (!existsSync(path)) return [];

	const source = withoutCommentedLines(readFileSync(path, "utf8"));
	const problems: string[] = [];

	if (!source.includes(`"${lankaDiContract.alias}/*"`)) {
		problems.push(
			`tsconfig.json has no "${lankaDiContract.alias}/*" path mapping. Add it under compilerOptions.paths:\n` +
				`      "${lankaDiContract.alias}/*": ["${lankaDiContract.dirname}/*"]`,
		);
	}

	// TypeScript's wildcard include skips dot-directories: `src/**/*` never
	// reaches `.lanka_di` however broad it looks, and neither does the DEFAULT
	// include, which is the same pattern. Without an explicit entry the barrels
	// compile only because something imports them: no `noUnusedLocals`, no
	// `strict`, no editor errors — in the one file that wires the whole app.
	//
	// The `include` ARRAY is read, not the whole file: `compilerOptions.paths`
	// also mentions `.lanka_di`, so a substring search over the whole `tsconfig`
	// finds that mapping and declares the include present.
	const include = /"include"\s*:\s*\[[^\]]*\]/.exec(source)?.[0] ?? "";
	if (!include.includes(lankaDiContract.dirname)) {
		problems.push(
			`tsconfig.json does not include "${lankaDiContract.dirname}". A wildcard include skips dot-directories, so add it explicitly:\n` +
				`      "${lankaDiContract.dirname}/**/*"`,
		);
	}

	return problems;
};

/**
 * Checks the consumer's `.lanka_di` directory and, when allowed, writes what is
 * missing.
 *
 * Free of any vite type on purpose: the plugin is a thin caller, and this can be
 * run from a CLI, a test or a postinstall without pulling in a bundler.
 */
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
function contractVersionProblems(dir: string): string[] {
	const file = join(dir, "Contract.ts");
	if (!existsSync(file)) return [];

	const source = readFileSync(file, "utf8");
	const match = /lankaDiContractVersion\s*(?::[^=]*)?=\s*(\d+)/.exec(source);

	if (!match) {
		return [
			`${lankaDiContract.dirname}/Contract.ts: the contract version is unreadable. Expected ` +
				`export const lankaDiContractVersion = ${String(lankaDiContract.version)};`,
		];
	}

	const declared = Number(match[1]);
	if (declared === lankaDiContract.version) return [];

	return [
		`${lankaDiContract.dirname}: contract version ${String(declared)}, the framework reads ` +
			`${String(lankaDiContract.version)}. The barrels and the framework describe ` +
			`different things — update the barrels to the new contract, or the framework ` +
			`to a version that knows yours.`,
	];
}

export function verifyLankaDi(root: string, options: { scaffold?: boolean } = {}): ILankaDiReport {
	const scaffold = options.scaffold ?? true;
	const dir = join(root, lankaDiContract.dirname);
	const created: string[] = [];
	const problems: string[] = [];

	if (!existsSync(dir)) {
		if (!scaffold) {
			return {
				dir,
				created,
				problems: [
					`${lankaDiContract.dirname}/ is missing. Run with scaffold enabled, or create it.`,
				],
			};
		}
		mkdirSync(dir, { recursive: true });
		created.push(`${lankaDiContract.dirname}/`);
	}

	for (const barrel of lankaDiContract.barrels) {
		const file = join(dir, barrel.file);

		if (!existsSync(file)) {
			if (!scaffold) {
				problems.push(`${lankaDiContract.dirname}/${barrel.file} is missing.`);
				continue;
			}
			writeFileSync(file, barrel.stub, "utf8");
			created.push(`${lankaDiContract.dirname}/${barrel.file}`);
			continue;
		}

		if (
			barrel.requiredExport &&
			!exportsName(readFileSync(file, "utf8"), barrel.requiredExport)
		) {
			problems.push(
				`${lankaDiContract.dirname}/${barrel.file} exists but does not export \`${barrel.requiredExport}\`, which lanka reads by name.`,
			);
		}
	}

	problems.push(...contractVersionProblems(dir));
	problems.push(...tsconfigProblems(root));

	return { dir, created, problems };
}
