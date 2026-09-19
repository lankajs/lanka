import { lankaDiContract } from "@lankajs/tool-di";
import { lankaInitBarrelFiles } from "../project-files/lanka-init-barrel-files/lankaInitBarrelFiles";
import { lankaInitBuildFiles } from "../project-files/lanka-init-build-files/lankaInitBuildFiles";
import { lankaInitSourceFiles } from "../project-files/lanka-init-source-files/lankaInitSourceFiles";
import type { ILankaInitAnswer } from "../_interfaces/ILankaInitAnswer";
import type { ILankaInitChoices } from "../_interfaces/ILankaInitChoices";
import type { ILankaInitDependency } from "../_interfaces/ILankaInitDependency";
import type { ILankaInitNote } from "../_interfaces/ILankaInitNote";
import type { ILankaInitPlan } from "../_interfaces/ILankaInitPlan";

/**
 * What every project gets, whichever template it is.
 *
 * `zustand` is core's one peer dependency, and only npm installs a missing peer:
 * under pnpm, yarn or bun it is a warning at install time and a resolution error
 * at build time. Naming it here means the question never comes up.
 *
 * `@lankajs/tool-di` is a DEVELOPMENT dependency and belongs to the build: it
 * publishes the bundler adapter that installs the alias, and nothing it holds
 * reaches a bundle.
 */
const BASE: readonly ILankaInitDependency[] = [
	{ name: "lanka", dev: false, from: "lanka" },
	{ name: "zustand", dev: false, from: "lanka" },
	{ name: "@lankajs/tool-di", dev: true, from: "lanka" },
	{ name: "typescript", dev: true, from: "lanka" },
];

/** Every answer taken, in the order a reader met the questions. */
const chosen = (choices: ILankaInitChoices): readonly ILankaInitAnswer[] => [
	choices.validator,
	choices.transport,
	choices.storage,
	...choices.extras,
];

const dependenciesOf = (choices: ILankaInitChoices): readonly ILankaInitDependency[] => {
	const { template } = choices;

	const fromAnswers = chosen(choices).flatMap((answer) => [
		...answer.packages.map((name) => ({ name, dev: false, from: answer.id })),
		...answer.devPackages.map((name) => ({ name, dev: true, from: answer.id })),
	]);

	return [
		...BASE,
		...template.packages.map((name) => ({ name, dev: false, from: template.id })),
		...template.devPackages.map((name) => ({ name, dev: true, from: template.id })),
		...fromAnswers,
		// A DOM for the test runner, and only when there is a DOM to have. The test
		// kit cannot declare it: `environment: "jsdom"` is a line in the config this
		// command writes, and only for a template that renders into a browser.
		...(needsJsdom(choices) ? [{ name: "jsdom", dev: true, from: "testing" }] : []),
	];
};

const needsJsdom = (choices: ILankaInitChoices): boolean =>
	choices.template.runtime.includes("browser") &&
	choices.extras.some((extra) => extra.id === "testing");

/**
 * What is left for the project to do, said once and where it will be read.
 *
 * Every answer that has a guide contributes one line, because the packages this
 * command INSTALLS are not the packages it writes code for: a storage engine and
 * a read cache arrive wired to nothing on purpose, and a note naming their guide
 * is the honest version of that rather than a generated call nobody asked for.
 */
const notesOf = (choices: ILankaInitChoices): readonly ILankaInitNote[] => [
	...choices.template.notes.map((text) => ({ subject: choices.template.id, text })),
	...chosen(choices)
		.filter((answer) => answer.guide !== undefined)
		.map((answer) => ({ subject: answer.id, text: `How to use it: ${answer.guide ?? ""}` })),
	{
		subject: "@lankajs/tool-di",
		text:
			`The barrels are written for contract version ${String(lankaDiContract.version)}. ` +
			"If the framework you install reads a different one it will say so on the first " +
			"build, by name — update the barrels, or install a framework that knows yours.",
	},
];

/**
 * Every decision, as the packages and the files it comes to.
 *
 * Pure: it reads no disk, runs nothing and asks nobody, which is what makes a
 * plan printable, comparable and testable in one call. Whether any of these
 * files is ALREADY THERE is a different question, and `applyLankaInit` — the
 * only part of this package holding a file system — is what answers it.
 */
export const planLankaInit = (choices: ILankaInitChoices): ILankaInitPlan => ({
	choices,
	dependencies: dependenciesOf(choices),
	files: [
		...lankaInitBarrelFiles(),
		...lankaInitBuildFiles(choices),
		...lankaInitSourceFiles(choices),
	],
	notes: notesOf(choices),
	contractVersion: lankaDiContract.version,
});
