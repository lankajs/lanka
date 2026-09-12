/**
 * @lankajs/plugin-http — request policy: what happens AROUND a network call
 * without being either a gateway or a transport.
 *
 * A plugin, not a module: the application never calls it. CORE calls it, on the
 * path of every request, through the declared `useRequestMiddleware` point. The
 * test question — "does core need a hook for this to work?" — answers yes.
 */

export { lankaHttp } from "./lanka-http/lankaHttp";
export type { ILankaHttpConfig } from "./_interfaces/ILankaHttpConfig";
export type { ILankaHttpErrorsConfig } from "./errors/errors-middleware/errorsMiddleware";
export type { ILankaHttpRetryConfig } from "./middleware/retry-middleware/retryMiddleware";
export type { ILankaHttpIdempotencyConfig } from "./middleware/idempotency-middleware/idempotencyMiddleware";
export type { ILankaHttpTimeoutConfig } from "./middleware/timeout-middleware/timeoutMiddleware";
export type { ILankaHttpAuthConfig } from "./middleware/auth-middleware/authMiddleware";
export type {
	ILankaHttpDefaultsConfig,
	TLankaHttpDefaultHeaders,
} from "./middleware/defaults-middleware/defaultsMiddleware";
export { lankaCodeFromErrorCode } from "./errors/lanka-code-from-error-code/lankaCodeFromErrorCode";
export { lankaMessageFromFieldErrors } from "./errors/lanka-message-from-field-errors/lankaMessageFromFieldErrors";
export { lankaFieldsFromErrorMap } from "./errors/lanka-fields-from-error-map/lankaFieldsFromErrorMap";
export { lankaMessageFromErrorList } from "./errors/lanka-message-from-error-list/lankaMessageFromErrorList";
export { lankaMessageFromDetail } from "./errors/lanka-message-from-detail/lankaMessageFromDetail";
export { lankaFirstOf } from "./errors/lanka-first-of/lankaFirstOf";
export { lankaUnsafeMethods } from "./config/lankaUnsafeMethods";

// Ready-made policies: the assembly work removed, the choice left outside. Each
// returns an ordinary config, and its `overrides` beats every line of it.
export { lankaSessionDefaults } from "./policies/lanka-session-defaults/lankaSessionDefaults";
export { lankaCookieSessionPolicy } from "./policies/lanka-cookie-session-policy/lankaCookieSessionPolicy";
export type { ILankaCookieSessionOptions } from "./policies/lanka-cookie-session-policy/lankaCookieSessionPolicy";
export { lankaTokenSessionPolicy } from "./policies/lanka-token-session-policy/lankaTokenSessionPolicy";
export type { ILankaTokenSessionOptions } from "./policies/lanka-token-session-policy/lankaTokenSessionPolicy";
