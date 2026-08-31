import { getLankaFlags } from "lanka";

/**
 * Starts a promise without awaiting it, with a rejection that is not lost.
 *
 * A bare `void promise` swallows the error: nothing listens, and at best an
 * "unhandled rejection" appears with no call site. Here the rejection is printed
 * in development and silent in production, where a console message costs bundle
 * size and log noise and tells the user nothing.
 */
export const safeFireAndForget = (promise: Promise<unknown>): void => {
	if (getLankaFlags().isDevelopment) {
		promise.catch(console.error);
	} else {
		promise.catch(() => {});
	}
};
