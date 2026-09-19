import { lankaDiContract } from "../lanka-di-contract/lankaDiContract";
import { migrateLankaDi } from "../migrate-lanka-di/migrateLankaDi";
import type { ILankaDiMigration } from "../migrate-lanka-di/migrateLankaDi";
import type { TLankaDiDirname } from "../lanka-di-contract/lankaDiContract";

/** What the `migrate` command needs, so a test can supply all of it. */
export interface IRunLankaDiMigrateOptions {
	readonly argv: readonly string[];
	readonly root: string;
	readonly write: (text: string) => void;
	readonly writeError: (text: string) => void;
	/** How a finished migration is put into words. The caller owns the wording. */
	readonly describe: (migration: ILankaDiMigration) => string;
	/** An option's value, distinguishing "not given" from "given with nothing after". */
	readonly optionValue: (argv: readonly string[], name: string) => string | null | undefined;
	readonly isDirname: (value: string) => value is TLankaDiDirname;
}

/**
 * The `migrate` command: read its options, refuse a bad one, then do the work.
 *
 * Its own unit because it is its own subject. `runLankaDiCli` decides WHICH
 * command ran, and a router that also parses one command's flags grows by the
 * length of every command added after it — which is how the dispatch stopped
 * being readable at four branches.
 *
 * Every refusal here writes to the error stream and answers a non-zero code,
 * because that is what a shell reads. A message on stdout with a zero exit is a
 * failure a script cannot see.
 */
export const runLankaDiMigrate = (options: IRunLankaDiMigrateOptions): number => {
	const { argv, root, write, writeError, describe, optionValue, isDirname } = options;
	const to = optionValue(argv, "--to");

	if (to === null) {
		writeError(
			`lanka-di: --to needs a directory after it. ` +
				`Use ${lankaDiContract.dirnames.join(" or ")}.\n`,
		);

		return 1;
	}

	if (to !== undefined && !isDirname(to)) {
		writeError(
			`lanka-di: --to ${to} is not a directory this framework reads. ` +
				`Use ${lankaDiContract.dirnames.join(" or ")}.\n`,
		);

		return 1;
	}

	const result = migrateLankaDi({ root, to, dryRun: argv.includes("--dry-run") });

	if (result.problems.length > 0) {
		writeError(`lanka-di: ${result.problems.join("\n\n")}\n`);

		return 1;
	}

	write(describe(result));

	return 0;
};
