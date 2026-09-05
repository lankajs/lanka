import type { ILankaHttpErrorsConfig } from "../errors/errors-middleware/errorsMiddleware";
import type { ILankaHttpRetryConfig } from "../retry-middleware/retryMiddleware";
import type { ILankaHttpIdempotencyConfig } from "../idempotency-middleware/idempotencyMiddleware";
import type { ILankaHttpTimeoutConfig } from "../timeout-middleware/timeoutMiddleware";
import type { ILankaHttpAuthConfig } from "../auth-middleware/authMiddleware";
import type { ILankaHttpDefaultsConfig } from "../defaults-middleware/defaultsMiddleware";

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
	 * What every request carries unless the call said otherwise: credentials and
	 * application-wide headers.
	 *
	 * Cookies in particular. A cookie session on a different origin sends nothing
	 * without `credentials: "include"`, and there is no other place to say so —
	 * core does not know about cookies, and a gateway writing the line on every
	 * call writes it fifty times.
	 */
	defaults?: ILankaHttpDefaultsConfig;

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
		/**
		 * Origins the header may be sent to, beyond the API's and the page's own.
		 *
		 * The token is a secret shared with one server. A gateway writing the whole
		 * URL of a file host or a payment provider must not carry it there: the
		 * third party would hold the one thing standing between a live cookie and
		 * a forged request. An application talking to several of ITS OWN APIs names
		 * them here; a relative endpoint never needs naming.
		 */
		origins?: readonly string[];
	};
}
