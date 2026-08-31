import type { ILankaHttpErrorsConfig } from "../errors/errors-middleware/errorsMiddleware";
import type { ILankaHttpRetryConfig } from "../retry-middleware/retryMiddleware";
import type { ILankaHttpIdempotencyConfig } from "../idempotency-middleware/idempotencyMiddleware";
import type { ILankaHttpTimeoutConfig } from "../timeout-middleware/timeoutMiddleware";
import type { ILankaHttpAuthConfig } from "../auth-middleware/authMiddleware";

export interface ILankaHttpConfig {
	/**
	 * Parsing the error response body: domain code, message, notification.
	 *
	 * Core provides the status and the host's text; everything backend-specific
	 * lives here.
	 */
	errors?: ILankaHttpErrorsConfig;
	/** Retrying what is safe to retry. */
	retry?: ILankaHttpRetryConfig;
	/** The key by which the server recognises a retried request. */
	idempotency?: ILankaHttpIdempotencyConfig;
	/** Request lifetime, including per request class. */
	timeout?: ILankaHttpTimeoutConfig;
	/** One auth refresh attempt per 401. */
	auth?: ILankaHttpAuthConfig;

	/**
	 * The header proving a request came from the application rather than from a
	 * third-party site riding a live cookie.
	 *
	 * Needed wherever the session lives in cookies: the browser attaches those to
	 * a request from someone else's page by itself, while a header it will not.
	 */
	csrf?: {
		header: string;
		value: string;
		/**
		 * Methods the header is added to. All unsafe ones by default: GET and HEAD
		 * change nothing, and requiring the header on them breaks link navigation
		 * for imaginary protection.
		 */
		methods?: readonly string[];
	};
}
