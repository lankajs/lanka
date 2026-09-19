import { lankaInitCatalog } from "../lanka-init-catalog/lankaInitCatalog";
import type { ILankaInitAnswer } from "../_interfaces/ILankaInitAnswer";
import type { ILankaInitChoices } from "../_interfaces/ILankaInitChoices";
import type { ILankaInitHost } from "../_interfaces/ILankaInitHost";
import type { ILankaInitQuestion } from "../_interfaces/ILankaInitQuestion";
import type { ILankaInitTemplate } from "../_interfaces/ILankaInitTemplate";

/** What was typed on the command line, already parsed. Anything absent is asked. */
export interface IReadLankaInitChoicesOptions {
	readonly host: ILankaInitHost;
	readonly root: string;
	readonly template?: string;
	readonly validator?: string;
	readonly transport?: string;
	readonly storage?: string;
	/** Extra ids, already split: a list here and never a comma-joined string. */
	readonly extras?: readonly string[];
	readonly apiBaseUrl?: string;
	/** Ask nothing, and take the template's own default for whatever was not typed. */
	readonly yes?: boolean;
}

/**
 * What a project gets when nobody says otherwise, and nobody can be asked.
 *
 * The commonest shape rather than the first row of a table: a default that has
 * to be justified is a default somebody thought about.
 */
const DEFAULT_TEMPLATE = "react-spa";

/** The base URL written into the host, and the note that says where to change it. */
const DEFAULT_API_BASE_URL = "/api";

/**
 * An id this package does not know, refused where it is READ.
 *
 * By name, with the list beside it, and once: everything downstream holds the
 * answer OBJECT rather than an id, so no later reader can meet an unknown one.
 */
const refuse = (subject: string, id: string, known: readonly { id: string }[]): never => {
	throw new Error(
		`lanka-init: unknown ${subject} "${id}".\n` +
			`  One of: ${known.map((one) => one.id).join(", ")}\n` +
			"  `lanka-init list` says what each of them installs.",
	);
};

/** Only what this template can actually run. */
const offered = (
	answers: readonly ILankaInitAnswer[],
	template: ILankaInitTemplate,
): readonly ILankaInitAnswer[] =>
	answers.filter((answer) => answer.runtime.some((one) => template.runtime.includes(one)));

/**
 * One answer: what was typed, or what was said, or what the template declares.
 *
 * In that order and never another: a flag beats a question because somebody
 * typed it deliberately, and a question beats a default because somebody is
 * there to answer. A port that answers `null` — a pipe, a runner, `--yes` — is
 * the same case as nobody being there at all.
 */
const resolve = async (
	given: string | undefined,
	question: ILankaInitQuestion,
	answers: readonly ILankaInitAnswer[],
	host: ILankaInitHost,
	yes: boolean,
): Promise<ILankaInitAnswer> => {
	const typed = given ?? (yes ? null : await host.askQuestion(question));
	const id = typed === null || typed === undefined || typed === "" ? question.defaultId : typed;

	return answers.find((answer) => answer.id === id) ?? refuse(question.subject, id, answers);
};

const question = (
	subject: string,
	prompt: string,
	answers: readonly ILankaInitAnswer[],
	defaultId: string,
	multiple = false,
): ILankaInitQuestion => ({ subject, prompt, answers, defaultId, multiple });

/** The template, which is the question every other answer is filtered by. */
const resolveTemplate = async (
	options: IReadLankaInitChoicesOptions,
): Promise<ILankaInitTemplate> => {
	const { templates } = lankaInitCatalog;
	const asked =
		options.template ??
		(options.yes === true
			? null
			: await options.host.askQuestion({
					subject: "template",
					prompt: "What is this project?",
					answers: templates,
					defaultId: DEFAULT_TEMPLATE,
					multiple: false,
				}));

	const id = asked === null || asked === undefined || asked === "" ? DEFAULT_TEMPLATE : asked;

	return templates.find((one) => one.id === id) ?? refuse("template", id, templates);
};

/**
 * The extras: any number of them, and the empty answer is a real one.
 *
 * `none` is spelled by answering nothing, which is why an empty string here is
 * not read as "take the default" the way it is everywhere else — somebody who
 * cleared the line meant to clear it.
 */
const resolveExtras = async (
	options: IReadLankaInitChoicesOptions,
	template: ILankaInitTemplate,
): Promise<readonly ILankaInitAnswer[]> => {
	const answers = offered(lankaInitCatalog.extras, template);
	const asked =
		options.extras ??
		(options.yes === true
			? null
			: await options.host.askQuestion(
					question(
						"extras",
						"Anything else? Several, separated by commas.",
						answers,
						template.defaults.extras.join(","),
						true,
					),
				));

	const ids = readExtraIds(asked, template);

	return answers.filter((answer) => ids.includes(answer.id));
};

/** What was given, as ids: a list stays one, a reply is split, nothing is the default. */
const readExtraIds = (
	asked: readonly string[] | string | null,
	template: ILankaInitTemplate,
): readonly string[] => {
	if (asked === null) return template.defaults.extras;
	if (typeof asked !== "string") return asked;

	return asked
		.split(",")
		.map((one) => one.trim())
		.filter(Boolean);
};

/**
 * The three axes with ONE answer each, bound to the template that filters them.
 *
 * A closure over the template, the port and `--yes`, because those three are the
 * same for all three questions and passing them to each would be five parameters
 * at every call — which `skills/composition/SKILL.md` 1a names as the sign that a
 * thing is not a unit.
 *
 * `extras` is deliberately not one of the three, and the type says so: its
 * default is a LIST, and `String(list)` would quietly make a default id out of
 * "eslint,testing".
 */
const axisReader =
	(template: ILankaInitTemplate, host: ILankaInitHost, yes: boolean) =>
	async (
		subject: "validator" | "transport" | "storage",
		prompt: string,
		answers: readonly ILankaInitAnswer[],
		given: string | undefined,
	): Promise<ILankaInitAnswer> => {
		const shown = offered(answers, template);
		const asked = question(subject, prompt, shown, template.defaults[subject]);

		return resolve(given, asked, shown, host, yes);
	};

/**
 * Every decision, resolved into the catalog's own entries.
 *
 * An unknown id is refused HERE, by name, with the list beside it. That is the
 * one place it can be refused usefully: after this, nothing holds an id, so
 * nothing below can meet one it does not understand.
 */
export const readLankaInitChoices = async (
	options: IReadLankaInitChoicesOptions,
): Promise<ILankaInitChoices> => {
	const template = await resolveTemplate(options);
	const ask = axisReader(template, options.host, options.yes ?? false);
	const { validators, transports, storages } = lankaInitCatalog;

	return {
		template,
		validator: await ask(
			"validator",
			"What validates a response?",
			validators,
			options.validator,
		),
		transport: await ask("transport", "How does it talk?", transports, options.transport),
		storage: await ask("storage", "What survives a reload?", storages, options.storage),
		extras: await resolveExtras(options, template),
		apiBaseUrl: options.apiBaseUrl ?? DEFAULT_API_BASE_URL,
		root: options.root,
	};
};
