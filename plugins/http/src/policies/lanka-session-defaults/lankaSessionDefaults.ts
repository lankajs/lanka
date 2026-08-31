import { lankaFirstOf } from "../../errors/lanka-first-of/lankaFirstOf";
import { lankaMessageFromDetail } from "../../errors/lanka-message-from-detail/lankaMessageFromDetail";
import { lankaMessageFromErrorList } from "../../errors/lanka-message-from-error-list/lankaMessageFromErrorList";
import { lankaMessageFromFieldErrors } from "../../errors/lanka-message-from-field-errors/lankaMessageFromFieldErrors";
import { lankaCodeFromErrorCode } from "../../errors/lanka-code-from-error-code/lankaCodeFromErrorCode";
import { lankaUnsafeMethods } from "../../config/lankaUnsafeMethods";
import type { ILankaHttpConfig } from "../../_interfaces/ILankaHttpConfig";

/**
 * The half of a request policy that does not depend on where the session lives.
 *
 * Retrying, the key that makes a retry recognisable, a deadline and reading a
 * failure body are the same decisions whether the session is a cookie or a
 * token. Only the proof of identity differs, which is why the two presets are
 * this plus one section each.
 *
 * Every value here is a DEFAULT a consumer overrides by spreading their own on
 * top; nothing is hidden inside the plugin.
 */
export const lankaSessionDefaults = (): ILankaHttpConfig => ({
	// The key is what makes retrying an unsafe method safe: without it the server
	// cannot tell a repeat from a second intent, and the plugin refuses the
	// configuration outright.
	idempotency: { header: "x-idempotency-key", methods: lankaUnsafeMethods },

	retry: {
		maxAttempts: 3,
		// Two waits for three attempts, growing: a burst that failed on a busy
		// server should not come back as three simultaneous requests.
		backoffMs: [200, 800],
		methods: ["GET", ...lankaUnsafeMethods],
		// 5xx and the two proxy answers that mean "not now". Never 4xx: the
		// request was understood and refused, and repeating it changes nothing.
		retryStatuses: [500, 502, 503, 504],
	},

	// Ten seconds: long enough for a slow mobile network, short enough that a
	// screen shows a failure rather than a spinner nobody will wait out.
	timeout: { defaultTimeoutMs: 10_000 },

	errors: {
		// Tried in order, first answer wins. Backends phrase a failure in at least
		// three ways and an application should not carry the fallback chain.
		extractMessage: lankaFirstOf(
			lankaMessageFromDetail,
			lankaMessageFromFieldErrors,
			lankaMessageFromErrorList,
		),
		extractCode: lankaCodeFromErrorCode,
	},
});
