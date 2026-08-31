/**
 * What middleware knows about the request it wraps.
 *
 * `options` is deliberately `unknown`: every transport has its own —
 * `RequestInit` for fetch, something else for the next one. Core does not read
 * them, it passes them along.
 */
export interface ILankaRequestContext {
	readonly endpoint: string;
	readonly options: unknown;
	/**
	 * Which attempt this is, counting from one.
	 *
	 * In the context rather than in the middleware itself, because a retry may be
	 * started by someone other than the one counting: an auth refresh restarts the
	 * request, and the retrying middleware must not mistake that for its own
	 * second attempt.
	 */
	readonly attempt: number;
	/**
	 * This attempt's deadline, when middleware assigned one.
	 *
	 * Read by CORE before every call into the transport, which is what allows a
	 * deadline per request class: a file upload and a list read cannot share one
	 * value, and the policy knows that difference while the framework does not.
	 */
	readonly timeoutMs?: number;
}

/**
 * A wrapper around a request.
 *
 * ## A wrapper rather than `onRequest` / `onResponse` / `onError`
 *
 * Three hooks cannot express RETRY. `onError` can replace an error but cannot
 * run the request again — and retry plus auth refresh are the two main abilities
 * a request-policy plugin exists for. A wrapper expresses those and everything
 * the hooks expressed.
 *
 * ## Why the objection to `next()` does not carry over
 *
 * On the event bus, middleware that skips `next` SILENCES the event: subscribers
 * do not run and nothing records it. Here, skipping `next` means returning a
 * value instead of a request — and the caller receives that value, so the
 * decision is visible.
 *
 * ## Order
 *
 * Registered first wraps all the rest: it sees the request before everyone and
 * the response after everyone — ordinary layer semantics, where "outer" means
 * outer.
 */
export type TLankaRequestMiddleware = (
	ctx: ILankaRequestContext,
	next: (ctx: ILankaRequestContext) => Promise<unknown>,
) => Promise<unknown>;

/**
 * Folds the chain into one function.
 *
 * An empty chain returns `perform` as-is, with no wrappers and no cost: an app
 * without a request-policy plugin has no middleware at all and must not pay for
 * their absence.
 */
export function composeLankaRequestMiddleware(
	middleware: readonly TLankaRequestMiddleware[],
	perform: (ctx: ILankaRequestContext) => Promise<unknown>,
): (ctx: ILankaRequestContext) => Promise<unknown> {
	if (middleware.length === 0) return perform;

	return middleware.reduceRight<(ctx: ILankaRequestContext) => Promise<unknown>>(
		(next, current) => (ctx) => current(ctx, next),
		perform,
	);
}
