import { isRecord } from "../../_internal/_guards/isRecord";
import { getStringField } from "../../_internal/_guards/getStringField";
import { getLankaHost } from "../../config/get-lanka-host/getLankaHost";
import { createLankaApiError } from "../_factories/create-lanka-api-error/createLankaApiError";

/** The length past which foreign text in a message stops helping. */
const RAW_TEXT_LIMIT = 200;

const nonEmpty = (body: Record<string, unknown>, key: string): string | undefined => {
	const value = getStringField(body, key);
	return value !== undefined && value.trim().length > 0 ? value.trim() : undefined;
};

/**
 * Normalises ANY unsuccessful response into a `LankaError`.
 *
 * Core does three things: reads the body once, takes `message` from it when it is
 * a string, and attaches the parsed body to the error. That is all.
 *
 * It parses no shapes. Body formats differ per backend, and a framework that
 * knows several knows none — it guesses. Parsing lives in `@lankajs/plugin-http`,
 * where it is configurable; the body travels with the error (`error.body`), so
 * the plugin parses it WITHOUT a second read of the `Response`, which is
 * impossible anyway: a stream is read once.
 *
 * ## Why an unparsed body is `http`, not `schema`
 *
 * The distinction carries a decision. `schema` means "the response is the wrong
 * shape" — the contract is broken and retrying is pointless. An ERROR body that
 * could not be parsed is not a broken contract: the server refused deliberately
 * and simply described it differently than expected.
 */
export const handleLankaApiError = async (response: Response): Promise<never> => {
	const raw = await response
		.clone()
		.text()
		.catch(() => "");

	let body: unknown;
	if (raw.trim().length > 0) {
		try {
			body = JSON.parse(raw);
		} catch {
			// A body that is not JSON is still the only description of the failure
			// there is, so it becomes the message rather than being discarded for
			// having the wrong shape.
			body = undefined;
		}
	}

	const message =
		(isRecord(body) ? nonEmpty(body, "message") : undefined) ??
		(body === undefined && raw.trim().length > 0
			? raw.trim().slice(0, RAW_TEXT_LIMIT)
			: undefined);

	throw createLankaApiError(
		response.status,
		message ? [message] : [getLankaHost().httpErrorMessage(response.status)],
		body,
	);
};
