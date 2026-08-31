import { isPlainRecord } from "../isPlainRecord";
import { firstMessage } from "../firstMessage";

/**
 * A message from field errors: `{ errors: { email: ["…"] } }`.
 *
 * The validation shape Nest, Laravel and Rails produce. Takes the FIRST message
 * of the first field: showing them all is a form's job, where there are places
 * for them; a banner has none.
 */
export const lankaMessageFromFieldErrors = (body: unknown): string | undefined => {
	if (!isPlainRecord(body)) return undefined;
	const errors = body.errors;
	if (!isPlainRecord(errors)) return undefined;

	for (const value of Object.values(errors)) {
		const message = firstMessage(value);
		if (message) return message;
	}
	return undefined;
};
