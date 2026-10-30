import { LankaError } from "lanka/errors";
import type { TLankaErrorKind } from "lanka/errors";
import type { ILankaRequestContext, TLankaRequestMiddleware } from "lanka/gateway";

export interface ILankaHttpRetryConfig {
	/** Total attempts including the first. Defaults to 3. */
	maxAttempts?: number;
	/**
	 * Backoff before each next attempt. Defaults to 200 · 500 · 1500 ms.
	 *
	 * Growing rather than constant: if the server is down under load, a steady
	 * stream of retries sustains that load.
	 */
	backoffMs?: readonly number[];
	/**
	 * Failure kinds that are retried. Defaults to `network` and `timeout`.
	 *
	 * A list of KINDS rather than statuses: a network failure and a timeout are
	 * retryable by nature — the request may never have arrived. `domain` is never
	 * retried: the server understood the request and refused deliberately, so a
	 * retry gives the same refusal, later.
	 */
	retryKinds?: readonly TLankaErrorKind[];
	/**
	 * Statuses retried in addition to the kinds. None by default.
	 *
	 * A sensible set is 502, 503, 504: the server did not refuse, it could not
	 * answer. Empty by default because for other 5xx a retry doubles the load on a
	 * system already in trouble.
	 */
	retryStatuses?: readonly number[];
	/**
	 * Methods allowed to be retried. All by default.
	 *
	 * Narrowing to safe ones is the only way to enable retry WITHOUT an
	 * idempotency key: see the configuration check in `index.ts`.
	 */
	methods?: readonly string[];
	/**
	 * The attempts for a SPECIFIC request. `undefined` takes `maxAttempts`; `1`
	 * sends it once. Asked once per request, before the first attempt.
	 *
	 * For the caller that owns its attempts — a poll that retries a 200 the policy
	 * cannot judge. Retried by the policy too, each of its attempts becomes three,
	 * each with its own deadline, and a hanging link turns one loop into minutes.
	 * What marks such a request — its path, or a field its gateway adds to its own
	 * options — is the application's knowledge, as for `timeout.resolveMs`.
	 *
	 * Asked only for methods `methods` allows: an answer can never retry an
	 * unkeyed unsafe request, which the build-time check refuses. The kinds and
	 * statuses still decide which failures are retried.
	 */
	resolveAttempts?: (ctx: ILankaRequestContext) => number | undefined;
}

const DEFAULT_BACKOFF_MS: readonly number[] = [200, 500, 1500];
const DEFAULT_KINDS: readonly TLankaErrorKind[] = ["network", "timeout"];

const sleep = (ms: number): Promise<void> =>
	new Promise((resolve) => {
		setTimeout(resolve, ms);
	});

/**
 * Retries what is safe to retry.
 *
 * ## Middleware rather than a wrapper at the call site
 *
 * A retry helper wrapped around INDIVIDUAL gateway calls means the decision is
 * taken again in every place, and by default there is no retry anywhere. As a
 * request policy it is enabled once and applies to every request meeting its
 * conditions.
 */
export const createRetryMiddleware = (config: ILankaHttpRetryConfig): TLankaRequestMiddleware => {
	const defaultAttempts = Math.max(1, config.maxAttempts ?? 3);
	const backoffMs = config.backoffMs ?? DEFAULT_BACKOFF_MS;
	const kinds = config.retryKinds ?? DEFAULT_KINDS;
	const statuses = config.retryStatuses ?? [];
	const methods = config.methods?.map((method) => method.toUpperCase());

	const isRetryable = (error: unknown): boolean => {
		if (!LankaError.is(error)) return false;
		if (kinds.includes(error.kind)) return true;
		return error.status !== undefined && statuses.includes(error.status);
	};

	return async (ctx, next) => {
		const method = ((ctx.options as RequestInit | undefined)?.method ?? "GET").toUpperCase();
		if (methods && !methods.includes(method)) return next(ctx);
		const resolved = config.resolveAttempts?.(ctx);
		const attempts =
			resolved === undefined ? defaultAttempts : Math.max(1, Math.floor(resolved));
		if (attempts === 1) return next(ctx);

		let lastError: unknown;
		for (let attempt = 1; attempt <= attempts; attempt += 1) {
			try {
				// `attempt` lives in the context: this middleware is not the only thing
				// that can retry — an auth refresh restarts the request — and the one
				// counting must not mistake someone else's restart for its own attempt.
				return await next({ ...ctx, attempt });
			} catch (error) {
				lastError = error;
				if (!isRetryable(error) || attempt === attempts) throw error;

				const delay = backoffMs[attempt - 1] ?? backoffMs[backoffMs.length - 1] ?? 0;
				if (delay > 0) await sleep(delay);
			}
		}

		throw lastError;
	};
};
