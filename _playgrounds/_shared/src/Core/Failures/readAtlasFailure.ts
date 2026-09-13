import { LankaError } from "lanka/errors";

/**
 * The sentence a screen should show, or `null` when it should show nothing.
 *
 * `null` for an `aborted` failure, and that is the whole reason this is a
 * function rather than `error.message` at every call site: the person who
 * cancelled knows they did, and telling them about it is the application
 * reporting its own plumbing.
 *
 * Anything that is not a `LankaError` is rethrown rather than shown. A
 * `TypeError` from a bug in a handler is not a message for a user, and
 * swallowing it into a banner is how a defect becomes "the server is down".
 */
export const readAtlasFailure = (failure: unknown): string | null => {
	if (!LankaError.is(failure)) throw failure;
	if (failure.isSilent) return null;

	return failure.message;
};
