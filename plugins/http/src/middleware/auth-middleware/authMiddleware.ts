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
 * ONE refresh for everybody who asks while it runs, and ONE sign-out when it fails.
 *
 * ## Why the refresh is shared
 *
 * A screen opens with five concurrent requests and all five get a 401. Five
 * refreshes would be five token rotations, four of which invalidate each other;
 * in the worst case the last cancels the one the first requests already retried
 * with. So whoever arrives first starts it, the rest await its result.
 *
 * ## Why the sign-out hangs off the refresh and not off a request
 *
 * `onRefreshFailed` promises to fire once per failed refresh and not once per
 * request that waited for one. Attached to the shared promise it keeps that
 * promise; called from the middleware body — where it was — it did not, because
 * every waiting request reaches that line for itself. Five concurrent 401s
 * produced five navigations to the sign-in screen, which is the sentence the
 * option's own documentation uses to explain why it does not.
 *
 * What the handler throws is CONTAINED. A handler that navigates, reports or
 * clears a store can fail, and the caller still needs the 401 it actually got:
 * letting the throw out replaces a failure the application can explain with one
 * from the sign-out mechanism, raised three layers from the cause.
 *
 * ## Why a request remembers which refresh it was sent after
 *
 * Sharing the refresh WHILE it runs is not enough. On a slow network a request
 * that left with the old token can have its 401 arrive after the refresh has
 * already finished; to the middleware that is a fresh 401, and it refreshed
 * again — a second rotation for a token that was already new. CI's two-core
 * runner counted two refreshes for one burst where every laptop counted one.
 * So each completed refresh advances a generation, a request records the
 * generation it was sent in, and a 401 for a request sent BEFORE the latest
 * refresh is retried with the new credentials instead of refreshing again.
 */
interface ILankaSharedRefresh {
	/** How many refreshes have succeeded — read when a request is sent. */
	generation: () => number;
	/** A refresh for a request sent in `sentIn`, or none if one succeeded since. */
	refreshFor: (sentIn: number) => Promise<boolean>;
}

const createSharedRefresh = (config: ILankaHttpAuthConfig): ILankaSharedRefresh => {
	let inFlight: Promise<boolean> | null = null;
	let generation = 0;

	const signOut = (): void => {
		try {
			config.onRefreshFailed?.();
		} catch {
			// Deliberately swallowed — see above.
		}
	};

	const refresh = (): Promise<boolean> => {
		inFlight ??= config
			.refreshAuth()
			.catch(() => false)
			.then((refreshed) => {
				if (refreshed) generation += 1;
				else signOut();
				return refreshed;
			})
			.finally(() => {
				inFlight = null;
			});
		return inFlight;
	};

	return {
		generation: () => generation,
		refreshFor: (sentIn) => (generation > sentIn ? Promise.resolve(true) : refresh()),
	};
};

/**
 * One refresh attempt per authorization failure, then a retry of the original
 * request. The sharing and the sign-out are `createSharedRefresh`'s.
 */
export const createAuthMiddleware = (config: ILankaHttpAuthConfig): TLankaRequestMiddleware => {
	const shared = createSharedRefresh(config);

	return async (ctx, next) => {
		const sentIn = shared.generation();
		try {
			return await next(ctx);
		} catch (error) {
			if (!LankaError.is(error) || error.status !== UNAUTHORIZED) throw error;
			if (config.shouldSkip?.(ctx.endpoint)) throw error;

			const refreshed = await shared.refreshFor(sentIn);
			if (!refreshed) throw error;

			// Exactly one retry. A second 401 after a successful refresh means the
			// refresh DOES NOT WORK, and the loop must break there: in production an
			// infinite loop looks like a hung interface rather than an error, and is
			// investigated far from where it started.
			return await next({ ...ctx, attempt: ctx.attempt + 1 });
		}
	};
};
