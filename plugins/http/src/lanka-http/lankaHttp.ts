import type { ILankaPlugin } from "lanka";
import { createCsrfMiddleware } from "../_internal/create-csrf-middleware/createCsrfMiddleware";
import { createErrorsMiddleware } from "../errors/errors-middleware/errorsMiddleware";
import { createRetryMiddleware } from "../retry-middleware/retryMiddleware";
import { createIdempotencyMiddleware } from "../idempotency-middleware/idempotencyMiddleware";
import { createTimeoutMiddleware } from "../timeout-middleware/timeoutMiddleware";
import { createAuthMiddleware } from "../auth-middleware/authMiddleware";
import { lankaUnsafeMethods } from "../config/lankaUnsafeMethods";
import type { ILankaHttpConfig } from "../_interfaces/ILankaHttpConfig";

/**
 * Retry without an idempotency key is more dangerous than no retry.
 *
 * A failure can happen AFTER the server performed the request: the response was
 * lost, the action happened. Retrying an unsafe method without a key reads as a
 * new intent and creates a second object — a payment, an invitation. Without
 * retry the user would see an error and decide; with this retry they see nothing
 * and there are two objects.
 *
 * So the configuration is rejected AT BUILD TIME rather than on the first retry
 * in production: a bug that waits for a network failure to appear waits for the
 * worst possible moment.
 */
const assertRetryIsSafe = (config: ILankaHttpConfig): void => {
	if (!config.retry || config.idempotency) return;

	const retried = config.retry.methods?.map((method) => method.toUpperCase()) ?? null;
	const touchesUnsafe =
		retried === null || retried.some((method) => lankaUnsafeMethods.includes(method));
	if (!touchesUnsafe) return;

	throw new Error(
		"@lankajs/plugin-http: retry without idempotency retries unsafe methods. " +
			'Configure idempotency, or narrow retry.methods to safe ones (for example ["GET"]).',
	);
};

export const lankaHttp = (config: ILankaHttpConfig = {}): ILankaPlugin => {
	assertRetryIsSafe(config);

	return {
		name: "@lankajs/plugin-http",
		install(lanka) {
			const removals: (() => void)[] = [];

			// Registration order is WRAPPING order: the first wraps them all.
			//
			// The deadline wraps everything: it must apply to a retried attempt and to
			// one that followed an auth refresh.
			//
			// Auth refresh sits outside retry: a 401 is not a network failure and
			// retrying it without refreshing is pointless, while retrying AFTER a
			// refresh is exactly right — which the inner retry does.
			//
			// Idempotency must sit OUTSIDE retry for a different reason: inside, it
			// would mint a new key per attempt — the very defect the key exists to
			// prevent.
			if (config.timeout) {
				removals.push(lanka.useRequestMiddleware(createTimeoutMiddleware(config.timeout)));
			}

			if (config.auth) {
				removals.push(lanka.useRequestMiddleware(createAuthMiddleware(config.auth)));
			}

			if (config.idempotency) {
				removals.push(
					lanka.useRequestMiddleware(createIdempotencyMiddleware(config.idempotency)),
				);
			}

			if (config.retry) {
				removals.push(lanka.useRequestMiddleware(createRetryMiddleware(config.retry)));
			}

			if (config.errors) {
				removals.push(lanka.useRequestMiddleware(createErrorsMiddleware(config.errors)));
			}

			if (config.csrf) {
				removals.push(lanka.useRequestMiddleware(createCsrfMiddleware(config.csrf)));
			}

			return () => {
				for (const remove of removals) remove();
			};
		},
	};
};
