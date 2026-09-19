import { applyLankaInit } from "../apply-lanka-init/applyLankaInit";
import { describeLankaInitCatalog } from "../describe-lanka-init-catalog/describeLankaInitCatalog";
import { describeLankaInitOutcome } from "../describe-lanka-init-outcome/describeLankaInitOutcome";
import { lankaNodeInitHost } from "../_adapters/lanka-node-init-host/lankaNodeInitHost";
import { planLankaInit } from "../plan-lanka-init/planLankaInit";
import { readLankaInitChoices } from "../read-lanka-init-choices/readLankaInitChoices";
import type { ILankaInitHost } from "../_interfaces/ILankaInitHost";

/** What the command needs from the world, so a test can supply all of it. */
export interface IRunLankaInitCliOptions {
	readonly argv: readonly string[];
	/** The project, unless `--root` says otherwise. */
	readonly root: string;
	readonly host?: ILankaInitHost;
	readonly write: (text: string) => void;
	readonly writeError: (text: string) => void;
}

const USAGE = `lanka-init — wire lanka into this project

  lanka-init [options]        ask, then write the wiring and install the packages
  lanka-init plan [options]   decide and report, write nothing and install nothing
  lanka-init list             every template and every answer, with what each installs

It does not create the application. Run the host's own scaffolder first —
\`npm create vite\`, \`create-next-app\`, \`create-expo-app\` — then this.

Options
  --template <id>    what this project is; \`list\` has the eleven
  --validator <id>   zod, valibot, arktype, yup, typebox, effect, none
  --transport <id>   http, graphql, grpc, none
  --storage <id>     web, unstorage, mmkv, async-storage, secure-store, none
  --with <a,b,c>     extras, comma-separated
  --api-url <url>    what the host's apiBaseUrl is written as (default: /api)
  --root <path>      the project directory (default: the working directory)
  --yes              ask nothing; take each template's own defaults
  --dry-run          the same as \`plan\`
  --no-install       write the files and leave the package manager alone

Nothing is ever overwritten. A file already there is reported and kept, so
running this again to add a validator is safe.
`;

/**
 * An option's value, refusing the one shape that would be read as silence.
 *
 * `argv[at + 1]` alone reads past the end and answers `undefined` —
 * indistinguishable from the flag being absent — so `--template` with nothing
 * after it would quietly scaffold the default one. The next flag is the same
 * mistake spelled differently: `--template --yes` would name a template called
 * `--yes`.
 */
const optionValue = (argv: readonly string[], name: string): string | undefined => {
	const at = argv.indexOf(name);
	if (at === -1) return undefined;

	const value = argv[at + 1];
	if (value === undefined || value.startsWith("--")) {
		throw new Error(`lanka-init: ${name} needs a value. \`lanka-init list\` has them.`);
	}

	return value;
};

/** The extras, split HERE: the list reaches everything below as a list. */
const extrasOf = (argv: readonly string[]): readonly string[] | undefined => {
	const given = optionValue(argv, "--with");
	if (given === undefined) return undefined;

	return given
		.split(",")
		.map((one) => one.trim())
		.filter(Boolean);
};

/** One run: ask, plan, and either write it or describe it. */
const init = async (options: IRunLankaInitCliOptions, dryRun: boolean): Promise<number> => {
	const { argv, write } = options;
	const host = options.host ?? lankaNodeInitHost;

	const choices = await readLankaInitChoices({
		host,
		root: optionValue(argv, "--root") ?? options.root,
		template: optionValue(argv, "--template"),
		validator: optionValue(argv, "--validator"),
		transport: optionValue(argv, "--transport"),
		storage: optionValue(argv, "--storage"),
		extras: extrasOf(argv),
		apiBaseUrl: optionValue(argv, "--api-url"),
		yes: argv.includes("--yes") || argv.includes("-y"),
	});

	const plan = planLankaInit(choices);
	const outcome = await applyLankaInit({
		plan,
		host,
		dryRun,
		install: !argv.includes("--no-install"),
	});

	write(describeLankaInitOutcome(plan, outcome));

	// A failed install is the one outcome that leaves work undone, and the exit
	// code has to say so: a script that ran this and read zero would go on to
	// build a project whose dependencies are not there.
	return outcome.installs?.some((one) => one.code !== 0) === true ? 1 : 0;
};

/**
 * The command, as a function.
 *
 * Everything it touches is a parameter — the arguments, the root, the port, both
 * output streams — so what a person sees is asserted in tests rather than
 * discovered by running it against a real project. The pattern is
 * `runLankaSkillsCli`'s and `runLankaDiCli`'s; what differs is the promise, and
 * only because this one asks questions: **a lanka command answers a number, or a
 * promise of one.**
 */
export const runLankaInitCli = async (options: IRunLankaInitCliOptions): Promise<number> => {
	const { argv, write, writeError } = options;
	const command = argv[0];

	if (command === "--help" || command === "-h" || command === "help") {
		write(USAGE);
		return 0;
	}

	if (command === "list") {
		write(describeLankaInitCatalog());
		return 0;
	}

	if (command !== undefined && command !== "plan" && !command.startsWith("-")) {
		writeError(`lanka-init: unknown command "${command}"\n\n${USAGE}`);
		return 1;
	}

	try {
		return await init(options, command === "plan" || argv.includes("--dry-run"));
	} catch (failure) {
		writeError(`${failure instanceof Error ? failure.message : String(failure)}\n`);
		return 1;
	}
};
