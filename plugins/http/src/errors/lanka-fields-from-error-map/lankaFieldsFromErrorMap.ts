import { isPlainRecord } from "../isPlainRecord";
import { nonEmptyString } from "../nonEmptyString";
import type { ILankaFieldError } from "lanka/errors";

/** A dotted or bracketed address as segments: `items.1.qty` → `["items", 1, "qty"]`. */
const toSegments = (address: string): (string | number)[] => {
	if (address === "") return [];

	return address
		.replace(/\[(\d+)\]/g, ".$1")
		.split(".")
		.map((segment) => (/^\d+$/.test(segment) ? Number(segment) : segment));
};

/** One entry of a field's list: a message, or a message with its reason named. */
const toFieldError = (path: (string | number)[], entry: unknown): ILankaFieldError | undefined => {
	const direct = nonEmptyString(entry);
	if (direct) return { path, message: direct };

	if (!isPlainRecord(entry)) return undefined;

	const message = nonEmptyString(entry.message) ?? nonEmptyString(entry.error);
	if (!message) return undefined;

	const code = nonEmptyString(entry.code);
	return code ? { path, message, code } : { path, message };
};

/**
 * Every message with the address of the input it belongs to:
 * `{ errors: { "items.1.qty": ["only 2 left"] } }`.
 *
 * The validation shape Nest, Laravel and Rails produce — the same body
 * `lankaMessageFromFieldErrors` reads for a BANNER, read here for a FORM. The
 * two are not variants of one extractor: a banner has one place and takes the
 * first message; a form has a place per input and needs all of them, with an
 * address each.
 *
 * The address arrives as SEGMENTS because only the producer knows which of them
 * was an index, and because the two form libraries spell the same address
 * differently. An empty key is the form's root — a cross-field refusal belongs
 * to the value as a whole, not to an input named `""`.
 *
 * Answers `undefined` rather than `[]` when it recognised no message, so
 * `lankaFirstOf` folds on it and the middleware can tell "I do not know this
 * shape" from "I know it and it was empty".
 */
export const lankaFieldsFromErrorMap = (body: unknown): ILankaFieldError[] | undefined => {
	if (!isPlainRecord(body)) return undefined;

	const errors = body.errors;
	if (!isPlainRecord(errors)) return undefined;

	const fields = Object.entries(errors).flatMap(([address, messages]) => {
		const path = toSegments(address);
		const entries = Array.isArray(messages) ? messages : [messages];

		return entries
			.map((entry) => toFieldError(path, entry))
			.filter((field): field is ILankaFieldError => field !== undefined);
	});

	return fields.length > 0 ? fields : undefined;
};
