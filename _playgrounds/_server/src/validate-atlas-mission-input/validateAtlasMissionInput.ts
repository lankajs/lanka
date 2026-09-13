/** What a person may type about a mission. Everything else the server decides. */
export interface IAtlasMissionInput {
	title?: unknown;
	priority?: unknown;
	crewId?: unknown;
}

/** Messages by field name, in the shape Nest, Laravel and Rails all produce. */
export type TAtlasFieldErrors = Record<string, string[]>;

const TITLE_MIN = 4;
const PRIORITY_MAX = 5;

const isFilled = (value: unknown): value is string =>
	typeof value === "string" && value.trim().length > 0;

/**
 * Checks what a person typed, and answers every problem rather than the first.
 *
 * Every problem, because a form has a place for each: stopping at the first
 * makes somebody fix one field, submit, and be told about the next.
 *
 * The shape is `{ field: [message] }`, which `lankaFieldsFromErrorMap` in
 * `@lankajs/plugin-http` already knows how to read — but a client still has to
 * SAY so. Core reads a status and the host's sentence and stops there, because
 * it cannot know which of the twenty conventions a given backend picked, so the
 * reader is named in the request policy (`errors.extractFieldErrors` in
 * `startAtlas`). Without that line these messages arrive as a banner and no
 * input is ever marked.
 */
export const validateAtlasMissionInput = (input: IAtlasMissionInput): TAtlasFieldErrors => {
	const errors: TAtlasFieldErrors = {};

	if (!isFilled(input.title)) errors.title = ["a mission needs a title"];
	else if (input.title.trim().length < TITLE_MIN) {
		errors.title = [`a title is at least ${String(TITLE_MIN)} characters`];
	}

	if (input.priority !== undefined) {
		const priority = Number(input.priority);
		if (!Number.isInteger(priority) || priority < 1 || priority > PRIORITY_MAX) {
			errors.priority = [`a priority is a whole number from 1 to ${String(PRIORITY_MAX)}`];
		}
	}

	return errors;
};
