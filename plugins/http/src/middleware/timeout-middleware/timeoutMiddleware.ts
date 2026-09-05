import type { ILankaRequestContext, TLankaRequestMiddleware } from "lanka/gateway";

export interface ILankaHttpTimeoutConfig {
	/** Default deadline for every request that says nothing else. */
	defaultTimeoutMs?: number;
	/**
	 * The deadline for a SPECIFIC request. `undefined` takes `defaultTimeoutMs`.
	 *
	 * A file upload and a list read cannot share one value: a deadline fit for a
	 * list aborts an upload midway, and one fit for an upload makes the user stare
	 * at a hung screen for two minutes. What counts as an upload is the
	 * application's knowledge — by path, by method, by body type.
	 */
	resolveMs?: (ctx: ILankaRequestContext) => number | undefined;
}

/**
 * Assigns a request's deadline.
 *
 * Core assembles the lifetime PER ATTEMPT and reads it from the context, so what
 * is assigned here also applies under retry, and every attempt gets its own full
 * deadline rather than what the previous ones left.
 */
export const createTimeoutMiddleware = (
	config: ILankaHttpTimeoutConfig,
): TLankaRequestMiddleware => {
	return (ctx, next) => {
		// A deadline the caller passed explicitly is not overridden: they know more
		// about their own request than a blanket policy does.
		if (ctx.timeoutMs !== undefined) return next(ctx);

		const timeoutMs = config.resolveMs?.(ctx) ?? config.defaultTimeoutMs;
		if (timeoutMs === undefined) return next(ctx);

		return next({ ...ctx, timeoutMs });
	};
};
