import { lankaNodeSkillHost } from "../_adapters/lanka-node-skill-host/lankaNodeSkillHost";
import { lankaDefaultSkillTarget } from "../lanka-default-skill-target/lankaDefaultSkillTarget";
import { syncLankaSkills } from "../sync-lanka-skills/syncLankaSkills";
import type { ILankaSkillHost } from "../_interfaces/ILankaSkillHost";
import type { ILankaSkillSyncPlan } from "../_interfaces/ILankaSkillSyncPlan";

/** What the command needs from the world, so a test can supply all of it. */
export interface IRunLankaSkillsCliOptions {
	argv: readonly string[];
	root: string;
	host?: ILankaSkillHost;
	write: (text: string) => void;
	writeError: (text: string) => void;
}

const USAGE = `lanka-skills — install the agent skills of the lanka packages you have

  lanka-skills sync [options]   copy them into the project
  lanka-skills list             say what would be copied, and write nothing

Options
  --dir <path>   where to install (default: ${lankaDefaultSkillTarget})
  --force        replace a skill directory this tool did not write
  --dry-run      decide and report, write nothing
`;

const optionValue = (argv: readonly string[], name: string): string | undefined => {
	const at = argv.indexOf(name);
	return at === -1 ? undefined : argv[at + 1];
};

const describe = (plan: ILankaSkillSyncPlan, dryRun: boolean): string => {
	const verb = dryRun ? " would be" : "";
	const lines = [
		...plan.install.map(
			(s) => `  + ${s.skill}${verb} installed  (${s.packageName}@${s.version})`,
		),
		...plan.update.map(
			(s) => `  ~ ${s.skill}${verb} updated    (${s.packageName}@${s.version})`,
		),
		...plan.conflict.map(
			(s) => `  ! ${s.skill} left alone — this tool did not write it; --force replaces it`,
		),
	];

	if (lines.length === 0) return "  nothing to do: no installed lanka package ships a skill";

	return lines.join("\n");
};

/**
 * The command, as a function.
 *
 * Everything it touches is a parameter — arguments, the root, the file system,
 * both output streams — so the whole surface a person sees is asserted in tests
 * rather than discovered by running it against a real project.
 *
 * A conflict does not fail the run: everything possible was done, and the one
 * thing refused is now a decision in front of the person who typed the command.
 */
export const runLankaSkillsCli = (options: IRunLankaSkillsCliOptions): number => {
	const { argv, root, write, writeError } = options;
	const command = argv[0] ?? "sync";

	if (command === "--help" || command === "-h" || command === "help") {
		write(USAGE);
		return 0;
	}

	if (command !== "sync" && command !== "list") {
		writeError(`lanka-skills: unknown command "${command}"\n\n${USAGE}`);
		return 1;
	}

	const dryRun = command === "list" || argv.includes("--dry-run");

	const plan = syncLankaSkills({
		root,
		host: options.host ?? lankaNodeSkillHost,
		target: optionValue(argv, "--dir"),
		force: argv.includes("--force"),
		dryRun,
	});

	write(`${describe(plan, dryRun)}\n`);

	return 0;
};
