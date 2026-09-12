import { lankaCodeFromErrorCode } from "../../src/index";
import { lankaFieldsFromErrorMap } from "../../src/index";
import { lankaFirstOf } from "../../src/index";
import { lankaMessageFromDetail } from "../../src/index";
import { lankaMessageFromErrorList } from "../../src/index";
import { lankaMessageFromFieldErrors } from "../../src/index";
import { lankaUnsafeMethods } from "../../src/index";
import type { lankaHttp } from "../../src/index";

/** What a consumer writes once at start-up, in the one place it belongs. */
export type TPlaygroundHttpPolicy = Parameters<typeof lankaHttp>[0];

/**
 * ONE backend's answering habits, stated as configuration.
 *
 * This is the package's point: request policy belongs to the application, not to
 * the framework. A different backend replaces this file and nothing else.
 */
export const createPlaygroundHttpPolicy = (
	overrides: TPlaygroundHttpPolicy = {},
): TPlaygroundHttpPolicy => ({
	csrf: { header: "x-csrf", value: "playground-token" },
	idempotency: { header: "x-idempotency-key" },
	// Unsafe methods are retried only because an idempotency key makes the repeat
	// recognisable as the same intent; without one the plugin refuses this
	// configuration outright.
	retry: {
		maxAttempts: 3,
		backoffMs: [0, 0],
		// The safe method plus every unsafe one, which the package names rather
		// than each application listing four strings and forgetting PATCH.
		methods: ["GET", ...lankaUnsafeMethods],
		retryStatuses: [500, 502, 503],
	},
	timeout: { defaultTimeoutMs: 1000 },
	errors: {
		// Tried in order, first answer wins: backends phrase a failure in at least
		// three ways, and an application should describe its own rather than write
		// the fallback chain by hand.
		extractMessage: lankaFirstOf(
			lankaMessageFromDetail,
			lankaMessageFromFieldErrors,
			lankaMessageFromErrorList,
		),
		extractCode: lankaCodeFromErrorCode,
		// The same body, read for the other reader: the banner gets one sentence
		// from `extractMessage` above, and a form gets every message with the
		// address of the input it belongs to.
		extractFieldErrors: lankaFieldsFromErrorMap,
	},
	...overrides,
});
