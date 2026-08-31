import { LankaError } from "lanka/errors";
import type { TLankaRequestMiddleware } from "lanka/gateway";

export interface ILankaHttpAuthConfig {
	/**
	 * Refreshes authorization. `true` means it worked and the request may be
	 * retried.
	 *
	 * PASSED AS A FUNCTION rather than an endpoint URL. Refreshing goes through
	 * the application layer, which knows the route, the cookies and headers it
	 * needs, and what to do with the response. A plugin that knew the endpoint
	 * would also know the response shape and the session storage, and would stop
	 * being a request policy.
	 */
	refreshAuth: () => Promise<boolean>;
	/**
	 * Paths where a refresh is not attempted. None by default.
	 *
	 * The sign-in and refresh routes themselves: a 401 there means there is
	 * nothing to refresh with, and refreshing to refresh is a loop.
	 */
	shouldSkip?: (endpoint: string) => boolean;
	/**
	 * The refresh failed. This is where the application signs the user out.
	 *
	 * Called ONCE per failed refresh, not per request that waited for it:
	 * otherwise five concurrent requests would produce five navigations to the
	 * sign-in screen.
	 */
	onRefreshFailed?: () => void;
}

/** Responses that mean "the session is gone". */
const UNAUTHORIZED = 401;

/**
 * One refresh attempt per authorization failure, then a retry of the original
 * request.
 *
 * ## Why the refresh is shared
 *
 * A screen opens with five concurrent requests and all five get a 401. Five
 * refreshes would be five token rotations, four of which invalidate each other;
 * in the worst case the last cancels the one the first requests already retried
 * with. So the refresh is shared: whoever arrives first starts it, the rest await
 * its result.
 */
export const createAuthMiddleware = (config: ILankaHttpAuthConfig): TLankaRequestMiddleware => {
	let inFlight: Promise<boolean> | null = null;

	const refreshOnce = (): Promise<boolean> => {
		inFlight ??= config
			.refreshAuth()
			.catch(() => false)
			.finally(() => {
				inFlight = null;
			});
		return inFlight;
	};

	return async (ctx, next) => {
		try {
			return await next(ctx);
		} catch (error) {
			if (!LankaError.is(error) || error.status !== UNAUTHORIZED) throw error;
			if (config.shouldSkip?.(ctx.endpoint)) throw error;

			const refreshed = await refreshOnce();
			if (!refreshed) {
				config.onRefreshFailed?.();
				throw error;
			}

			// Exactly one retry. A second 401 after a successful refresh means the
			// refresh DOES NOT WORK, and the loop must break there: in production an
			// infinite loop looks like a hung interface rather than an error, and is
			// investigated far from where it started.
			return await next({ ...ctx, attempt: ctx.attempt + 1 });
		}
	};
};
