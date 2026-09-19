import type { ILankaInitHost } from "../_interfaces/ILankaInitHost";
import type {
	ILankaInitInstall,
	ILankaInitKept,
	ILankaInitOutcome,
	ILankaInitWritten,
} from "../_interfaces/ILankaInitOutcome";
import type { ILankaInitNote } from "../_interfaces/ILankaInitNote";
import type { ILankaInitPlan } from "../_interfaces/ILankaInitPlan";

/** What a run needs from the world, and what it is allowed to do to it. */
export interface IApplyLankaInitOptions {
	readonly plan: ILankaInitPlan;
	readonly host: ILankaInitHost;
	/** Decide and report; write nothing and run nothing. */
	readonly dryRun?: boolean;
	/** Hand what is missing to the project's package manager. On by default. */
	readonly install?: boolean;
}

/**
 * How each package manager is asked to add a dependency.
 *
 * Read from the LOCKFILE rather than asked, because the answer is already in the
 * project and getting it wrong is not a preference — `pnpm install --save-dev`
 * is not a command, and a project told to run it learns that this tool guessed.
 */
const MANAGERS = [
	{ lockfile: "pnpm-lock.yaml", command: "pnpm", add: ["add"], dev: ["add", "-D"] },
	{ lockfile: "yarn.lock", command: "yarn", add: ["add"], dev: ["add", "-D"] },
	{ lockfile: "bun.lock", command: "bun", add: ["add"], dev: ["add", "-d"] },
	{ lockfile: "bun.lockb", command: "bun", add: ["add"], dev: ["add", "-d"] },
	{
		lockfile: "package-lock.json",
		command: "npm",
		add: ["install"],
		dev: ["install", "--save-dev"],
	},
] as const;

/** npm last: it is the one every machine has, so it is the answer to "none of these". */
const managerOf = (host: ILankaInitHost, root: string): (typeof MANAGERS)[number] =>
	MANAGERS.find((manager) => host.exists(`${root}/${manager.lockfile}`)) ??
	MANAGERS[MANAGERS.length - 1];

/**
 * Every dependency name the project's manifest already declares.
 *
 * A name in here is a version somebody chose. Asking the package manager for it
 * again is how a scaffolder moves a range nobody asked it to touch — so what is
 * already declared is left alone, whatever this plan would have named it.
 *
 * A manifest that does not parse answers "nothing declared" rather than ending
 * the run: the install is what the project came for, and the worst this costs is
 * a package manager being asked for something it already has.
 */
const declared = (host: ILankaInitHost, root: string): ReadonlySet<string> => {
	try {
		const manifest = JSON.parse(host.readTextFile(`${root}/package.json`) ?? "{}") as {
			dependencies?: Record<string, string>;
			devDependencies?: Record<string, string>;
		};

		return new Set([
			...Object.keys(manifest.dependencies ?? {}),
			...Object.keys(manifest.devDependencies ?? {}),
		]);
	} catch {
		return new Set();
	}
};

/** Each file, written when it is missing and reported when it is not. */
const writeFiles = (
	options: IApplyLankaInitOptions,
	dryRun: boolean,
): { written: ILankaInitWritten[]; kept: ILankaInitKept[] } => {
	const { plan, host } = options;
	const written: ILankaInitWritten[] = [];
	const kept: ILankaInitKept[] = [];

	for (const file of plan.files) {
		const path = `${plan.choices.root}/${file.path}`;

		if (host.exists(path)) {
			kept.push({
				path: file.path,
				reason:
					file.whenKept ?? "already here, and nothing overwrites what it did not write",
			});
			continue;
		}

		if (!dryRun) host.writeTextFile(path, file.text);
		written.push({ path: file.path, gist: file.gist });
	}

	return { written, kept };
};

/**
 * The install, as at most two commands: the runtime list, then the development one.
 *
 * Two rather than one because the flag differs, and one rather than one per
 * package because a package manager resolves a set faster than it resolves the
 * same set N times — and because a failure halfway through a list of twelve is a
 * project in a state nobody chose.
 */
const runInstalls = async (
	options: IApplyLankaInitOptions,
): Promise<readonly ILankaInitInstall[]> => {
	const { plan, host } = options;
	const root = plan.choices.root;
	const already = declared(host, root);
	const manager = managerOf(host, root);
	const missing = (dev: boolean): readonly string[] => [
		...new Set(
			plan.dependencies
				.filter((one) => one.dev === dev && !already.has(one.name))
				.map((one) => one.name),
		),
	];

	return [
		...(await install(host, root, manager.command, manager.add, missing(false))),
		...(await install(host, root, manager.command, manager.dev, missing(true))),
	];
};

/** One command, or none at all when there is nothing left to add. */
const install = async (
	host: ILankaInitHost,
	root: string,
	command: string,
	flags: readonly string[],
	names: readonly string[],
): Promise<readonly ILankaInitInstall[]> => {
	if (names.length === 0) return [];

	const args = [...flags, ...names];

	return [{ command, args, code: await host.runCommand(command, args, root) }];
};

/**
 * The plan, against a real project.
 *
 * **Nothing is overwritten, ever.** A file already there is reported and kept,
 * and the plan's own `whenKept` line says what the project may still have to do
 * about it. This command is run twice more often than it is run once — a project
 * adds a validator six months later — and a scaffolder that rewrites what a team
 * has edited is a scaffolder nobody runs the second time.
 *
 * A partial result is possible and is reported rather than hidden: the files are
 * written before the install runs, so a package manager that fails leaves a
 * project whose wiring is correct and whose `node_modules` is not. Running the
 * command again writes nothing and installs the rest, which is the recovery and
 * needs no flag.
 *
 * The order is also what lets the install assume a manifest. `package.json` is
 * one of the planned files, so an empty directory has one by the time a package
 * manager is asked to add anything to it — and `pnpm add` in a directory without
 * one is an error that would end the whole command.
 */
export const applyLankaInit = async (
	options: IApplyLankaInitOptions,
): Promise<ILankaInitOutcome> => {
	const dryRun = options.dryRun ?? false;
	const notes: readonly ILankaInitNote[] = options.plan.notes;
	const { written, kept } = writeFiles(options, dryRun);
	const installs = dryRun || options.install === false ? null : await runInstalls(options);

	return { written, kept, installs, notes, dryRun };
};
