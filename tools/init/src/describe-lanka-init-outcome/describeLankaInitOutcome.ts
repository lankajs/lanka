import type { ILankaInitOutcome } from "../_interfaces/ILankaInitOutcome";
import type { ILankaInitPlan } from "../_interfaces/ILankaInitPlan";

/**
 * What a run did, as a person reads it.
 *
 * Three lists and a verb tense. A dry run says "would", a real one says what it
 * did, and nothing else about the two differs — which is the point, because a
 * preview that reads differently from the thing it previews is a preview nobody
 * trusts twice.
 */

const PATH_WIDTH = 34;

/**
 * A path and what it is for, with the two never touching.
 *
 * `padEnd` alone pads a SHORT path and does nothing at all to a long one, so
 * `TodoGateway.tsthe endpoints` is what a deep path produced — the one column
 * that has to hold for the output to be readable, and the one case a fixed
 * width silently drops.
 */
const row = (mark: string, path: string, says: string): string =>
	`  ${mark} ${path.padEnd(PATH_WIDTH)} ${says}`;

const written = (outcome: ILankaInitOutcome): string =>
	outcome.written.map((one) => row("+", one.path, one.gist)).join("\n");

const kept = (outcome: ILankaInitOutcome): string =>
	outcome.kept.map((one) => row("=", one.path, one.reason)).join("\n");

/**
 * The dependencies, by list, and never with a version beside them.
 *
 * The range is the package manager's answer, not this command's: one written
 * here would be whatever was current on the day this tool was built.
 */
const dependencies = (plan: ILankaInitPlan, dev: boolean): string => {
	const names = [
		...new Set(plan.dependencies.filter((one) => one.dev === dev).map((one) => one.name)),
	];

	return names.length === 0 ? "" : `  ${dev ? "dev" : "   "}  ${names.join(" ")}\n`;
};

/**
 * What became of the install, in the three states a reader acts differently on.
 *
 * A dry run says nothing about it, because nothing would have happened either
 * way. "Never asked" names the flag that caused it, so the dependencies above
 * read as a list to act on. And "nothing left" has to be said out loud: silence
 * where an install was expected reads as an install that failed.
 */
const installs = (outcome: ILankaInitOutcome): string => {
	if (outcome.dryRun) return "";
	if (outcome.installs === null) {
		return "\nNot installed, because --no-install. The dependencies above are what to add.\n";
	}

	if (outcome.installs.length === 0) return "\nNothing left to install.\n";

	const lines = outcome.installs.map(
		(one) =>
			`  ${one.command} ${one.args.join(" ")}\n` +
			`      ${one.code === 0 ? "done" : `FAILED, exit code ${String(one.code)}`}`,
	);

	return `\nInstalled\n${lines.join("\n")}\n`;
};

const notes = (outcome: ILankaInitOutcome): string =>
	outcome.notes.length === 0
		? ""
		: `\nStill yours to do\n${outcome.notes
				.map((note) => `  - ${note.subject}: ${note.text}`)
				.join("\n")}\n`;

/** A run, or a run that has not happened, in the same shape. */
export const describeLankaInitOutcome = (
	plan: ILankaInitPlan,
	outcome: ILankaInitOutcome,
): string => {
	const { choices } = plan;
	const taken = [choices.validator, choices.transport, choices.storage, ...choices.extras]
		.filter((answer) => answer.id !== "none")
		.map((answer) => answer.id);

	return (
		`\n${choices.template.title}  (${choices.template.id})\n` +
		`  ${taken.length === 0 ? "nothing else taken" : taken.join(", ")}\n` +
		`\n${outcome.dryRun ? "Would write" : "Wrote"}\n${written(outcome)}\n` +
		(outcome.kept.length === 0 ? "" : `\nLeft alone\n${kept(outcome)}\n`) +
		`\nDependencies\n${dependencies(plan, false)}${dependencies(plan, true)}` +
		installs(outcome) +
		notes(outcome)
	);
};
