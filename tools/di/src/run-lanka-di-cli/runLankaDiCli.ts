import { lankaDiContract } from "../lanka-di-contract/lankaDiContract";
import { runLankaDiMigrate } from "../run-lanka-di-migrate/runLankaDiMigrate";
import { otherLankaDiDirname } from "../_utils/other-lanka-di-dirname/otherLankaDiDirname";
import { resolveLankaDiDir } from "../resolve-lanka-di-dir/resolveLankaDiDir";
import { resolveLankaDiShards } from "../resolve-lanka-di-shards/resolveLankaDiShards";
import type { ILankaDiMigration } from "../migrate-lanka-di/migrateLankaDi";
import type { TLankaDiDirname } from "../lanka-di-contract/lankaDiContract";

/** What the command needs from the world, so a test can supply all of it. */
export interface IRunLankaDiCliOptions {
	readonly argv: readonly string[];
	readonly root: string;
	readonly write: (text: string) => void;
	readonly writeError: (text: string) => void;
}

const USAGE = `lanka-di — the barrel directory your application publishes to lanka

  lanka-di where              say which directory this project uses
  lanka-di migrate [options]  move the barrels to the other one

Both ${lankaDiContract.dirnames.join(" and ")} are supported and neither is deprecated.
${lankaDiContract.dirname} is what a new project gets; a project already on the other keeps it.

Options
  --to <dir>   ${lankaDiContract.dirnames.join(" or ")} (default: ${lankaDiContract.dirname})
  --dry-run    decide and report, write nothing
`;

/**
 * An option's value, distinguishing "not given" from "given with nothing after".
 *
 * `argv[at + 1]` alone reads past the end of the arguments and answers
 * `undefined` — indistinguishable from the flag being absent, so `lanka-di
 * migrate --to` would fall back to the default and move somebody's barrels
 * somewhere they did not ask for, reporting success while doing it.
 */
const optionValue = (argv: readonly string[], name: string): string | null | undefined => {
	const at = argv.indexOf(name);
	if (at === -1) return undefined;

	return argv[at + 1] ?? null;
};

/**
 * `--to`, checked against the contract rather than trusted.
 *
 * A typo accepted here would rename the directory to something the framework
 * cannot find, and the failure would arrive one build later as "module not
 * found", with nothing pointing back at the command that caused it.
 */
const isDirname = (value: string): value is TLankaDiDirname =>
	lankaDiContract.dirnames.some((dirname) => dirname === value);

/**
 * What a finished migration says.
 *
 * The reminder at the end is deliberate and unconditional: this tool renames one
 * directory and rewrites the `tsconfig` files beside it, and anything ELSE in a
 * repository naming the old directory — a script, a CI config, an editor
 * setting, a `.gitignore` — is the person's to find. Saying so every time is
 * cheaper than being silent the one time it mattered.
 */
const describeMigration = (result: ILankaDiMigration): string => {
	if (result.from === null) {
		return `nothing to do: this project is already on ${result.to}/\n`;
	}

	const lines = result.steps.map((step) => `  ${step}`);

	return (
		`${result.dryRun ? "would change" : "changed"}:\n` +
		`${lines.join("\n")}\n\n` +
		`Commit the rename. Then check whether anything else names ${result.from}: a script, a\n` +
		`CI config, an editor setting, a .gitignore. This command touches the directory and the\n` +
		`tsconfig files beside it, and nothing further.\n`
	);
};

const describeWhere = (root: string): string => {
	const { dirname, found } = resolveLankaDiDir(root);

	if (found.length === 0) {
		return (
			`no barrel directory yet. A build would scaffold ${dirname}/, which is the default.\n` +
			`Both ${lankaDiContract.dirnames.join(" and ")} are supported.\n`
		);
	}

	if (found.length > 1) return describeLayout(root, dirname);

	return `${dirname}/\n`;
};

/**
 * Both directories, barrel by barrel.
 *
 * A project using both is using them for a reason nothing here can read — by
 * abstraction, by shard, by whatever the team decided — so this reports the
 * LAYOUT rather than an opinion about it. The one thing worth saying out loud is
 * which directory the alias resolves to, because that is the one the framework
 * reads directly and the other reaches it through a re-export.
 *
 * Per barrel and not per directory: "both are in use" is the answer somebody
 * already has if they are asking. Which of the six is where is the answer they
 * came for.
 */
const describeLayout = (root: string, primary: TLankaDiDirname): string => {
	const rows = resolveLankaDiShards(root, primary).map((shard) => {
		const where = shard.holders.length === 0 ? "— (missing)" : shard.holders.join(" + ");
		return `  ${shard.barrel.file.padEnd(16)}${where}`;
	});

	return (
		`${primary}/ and ${otherLankaDiDirname(primary)}/ are both in use.\n\n` +
		`${lankaDiContract.alias}/* resolves to ${primary}/, so that is what the framework reads;\n` +
		`what the other holds reaches it through a re-export in ${primary}/.\n\n` +
		`${rows.join("\n")}\n`
	);
};

/**
 * The command, as a function.
 *
 * Everything it touches is a parameter — arguments, the root, both output
 * streams — so what a person sees is asserted in tests rather than discovered by
 * running it against a real project. The pattern is `runLankaSkillsCli`'s, and
 * for the same reason: a bin runs at import, and a line that runs at import is a
 * line no test reaches without running the program.
 */
export const runLankaDiCli = (options: IRunLankaDiCliOptions): number => {
	const { argv, root, write, writeError } = options;
	const command = argv[0];

	if (command === undefined || command === "--help" || command === "-h" || command === "help") {
		write(USAGE);
		return 0;
	}

	if (command === "where") {
		write(describeWhere(root));
		return 0;
	}

	if (command !== "migrate") {
		writeError(`lanka-di: unknown command "${command}"\n\n${USAGE}`);
		return 1;
	}

	return runLankaDiMigrate({
		argv,
		root,
		write,
		writeError,
		describe: describeMigration,
		optionValue,
		isDirname,
	});
};
