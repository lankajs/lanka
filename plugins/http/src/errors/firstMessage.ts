import { isPlainRecord } from "./isPlainRecord";
import { nonEmptyString } from "./nonEmptyString";

/** The first usable message from a string, an array or an object with `message`. */
export function firstMessage(value: unknown): string | undefined {
	const direct = nonEmptyString(value);
	if (direct) return direct;

	if (Array.isArray(value)) {
		for (const entry of value) {
			const message = firstMessage(entry);
			if (message) return message;
		}
		return undefined;
	}

	if (isPlainRecord(value)) {
		return nonEmptyString(value.message) ?? nonEmptyString(value.error);
	}

	return undefined;
}
