import { isPlainRecord } from "../isPlainRecord";
import { nonEmptyString } from "../nonEmptyString";

/**
 * The domain failure code: `errorCode`, else `error` as a string.
 *
 * The code is what an application branches on: one sends the user to sign in,
 * another means a stale page, the rest are shown in a banner. Without it a
 * ViewModel has only text, and text is not something you branch on.
 */
export const lankaCodeFromErrorCode = (body: unknown): string | undefined => {
	if (!isPlainRecord(body)) return undefined;
	return nonEmptyString(body.errorCode) ?? nonEmptyString(body.error);
};
