import { isPlainRecord } from "../isPlainRecord";
import { firstMessage } from "../firstMessage";

/**
 * A message from an error array: `{ errors: ["…"] }` or
 * `{ errors: [{ message: "…" }] }`.
 */
export const lankaMessageFromErrorList = (body: unknown): string | undefined => {
	if (!isPlainRecord(body)) return undefined;
	return firstMessage(body.errors);
};
