import { lankaInitCatalog } from "../lanka-init-catalog/lankaInitCatalog";
import type { ILankaInitAnswer } from "../_interfaces/ILankaInitAnswer";

/**
 * The catalog, as a person reads it: every question, every answer, and what each
 * one installs.
 *
 * What it installs is the whole point of printing it. A list of names is a list
 * somebody has to look up one at a time; a list of names with their packages
 * beside them is the answer to "what does taking this cost me", which is the
 * only question anybody is actually asking at that moment.
 */

const ID_WIDTH = 16;

const packagesOf = (answer: ILankaInitAnswer): string => {
	const names = [...answer.packages, ...answer.devPackages];

	return names.length === 0 ? "" : `\n${" ".repeat(ID_WIDTH + 2)}${names.join(", ")}`;
};

const answerLines = (answers: readonly ILankaInitAnswer[]): string =>
	answers
		.map((answer) => `  ${answer.id.padEnd(ID_WIDTH)}${answer.gist}${packagesOf(answer)}`)
		.join("\n");

const section = (title: string, body: string): string => `\n${title}\n${body}\n`;

/** Every template and every answer, in the order the questions are asked. */
export const describeLankaInitCatalog = (): string =>
	section(
		"Templates  --template",
		lankaInitCatalog.templates
			.map(
				(template) =>
					`  ${template.id.padEnd(ID_WIDTH)}${template.title}\n` +
					`${" ".repeat(ID_WIDTH + 2)}${template.gist}`,
			)
			.join("\n"),
	) +
	section("Validators  --validator", answerLines(lankaInitCatalog.validators)) +
	section("Transports  --transport", answerLines(lankaInitCatalog.transports)) +
	section("Storage  --storage", answerLines(lankaInitCatalog.storages)) +
	section("Extras  --with a,b,c", answerLines(lankaInitCatalog.extras)) +
	"\nAn answer a template cannot run is not offered: a browser template never\n" +
	"suggests MMKV, and a device never suggests the inspector.\n";
