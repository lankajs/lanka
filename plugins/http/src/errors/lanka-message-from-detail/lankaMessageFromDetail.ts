import { isPlainRecord } from "../isPlainRecord";
import { nonEmptyString } from "../nonEmptyString";

/** A message from `detail` — the RFC 7807 (problem+json) shape. */
export const lankaMessageFromDetail = (body: unknown): string | undefined => {
	if (!isPlainRecord(body)) return undefined;
	return nonEmptyString(body.detail);
};
