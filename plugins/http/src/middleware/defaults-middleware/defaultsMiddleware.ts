import type { TLankaRequestInit, TLankaRequestMiddleware } from "lanka/gateway";

/**
 * What every request carries unless the call said otherwise.
 *
 * Small, and deliberately not a general `RequestInit` bag. Two fields earned
 * their place by being the two an application cannot do without and cannot set
 * anywhere else; a third, when one earns it, is a named field with its own
 * reason, not another key in an opaque object.
 */
export interface ILankaHttpDefaultsConfig {
	/**
	 * Whether the browser attaches cookies, and to whom.
	 *
	 * The field this package existed without for too long. A cookie session on a
	 * different origin — an API on `api.example.com`, a front end on
	 * `app.example.com`, which is the ordinary deployment — sends NO cookie
	 * without `"include"`, and `fetch` defaults to `"same-origin"`. A CSRF header
	 * without the cookie it protects proves the request came from the application
	 * and authenticates nobody.
	 *
	 * It cannot be set anywhere else: core does not know about cookies on purpose
	 * (node and React Native have none), and a gateway method writing
	 * `credentials: "include"` on every call is the line an application copies
	 * fifty times and then moves into a transport of its own.
	 */
	credentials?: RequestCredentials;

	/**
	 * Headers added to every request. A header the CALL set wins.
	 *
	 * `Accept`, a client version, a build id, a tenant — the ones that are true of
	 * every request an application makes and belong to none of its gateways.
	 *
	 * A FUNCTION is accepted because some of them are only true right now: a value
	 * read from a context that changes between requests, a token rotated mid
	 * session. It is called once per attempt, so a retry after a refresh carries
	 * the new value rather than the one the first attempt was built with.
	 *
	 * A value of `undefined` is skipped rather than sent empty: a build variable
	 * that is not set should produce no header, not `X-Client-Version: undefined`.
	 */
	headers?: TLankaHttpDefaultHeaders | (() => TLankaHttpDefaultHeaders);
}

/** Header names to values, where a missing value means the header is not sent. */
export type TLankaHttpDefaultHeaders = Readonly<Record<string, string | undefined>>;

/**
 * Fills in what the call left unsaid, and overrides nothing.
 *
 * Registered LAST, which makes it the innermost wrapper: it runs closest to the
 * transport and therefore sees the CSRF header, the idempotency key and whatever
 * a retried attempt rebuilt. Filling gaps from the inside is the only order in
 * which "a default" is true — from the outside it would be a default that the
 * layers above then quietly replace.
 *
 * ## Why it materialises options that were absent
 *
 * A gateway method with nothing to say calls `this.request("me")`, and core
 * passes `undefined` options through untouched — "nothing was passed" and "an
 * empty object" are different statements, and the transport is entitled to tell
 * them apart. Here they stop being different: the application HAS said
 * something, once, in its policy. A `GET /users/me` with no options is exactly
 * the request that needs the cookie.
 */
export const createDefaultsMiddleware = (
	config: ILankaHttpDefaultsConfig,
): TLankaRequestMiddleware => {
	const { credentials, headers } = config;
	const readHeaders = typeof headers === "function" ? headers : () => headers;

	return (ctx, next) => {
		const options = (ctx.options ?? {}) as TLankaRequestInit;
		const defaultHeaders = readHeaders();

		const patched: TLankaRequestInit = { ...options };
		// `??`, not an unconditional write: a call asking for `"omit"` — a health
		// check, a request to a third party — means it, and a default that beat it
		// would leak the session cookie to whoever that is.
		if (credentials !== undefined) patched.credentials = options.credentials ?? credentials;
		if (defaultHeaders !== undefined) patched.headers = merged(defaultHeaders, options.headers);

		return next({ ...ctx, options: patched });
	};
};

/**
 * The defaults, with the call's own headers laid over them.
 *
 * The call wins because it is the more specific statement: a gateway sending
 * `Accept: text/csv` for one export has said something about that request that
 * the application-wide `Accept: application/json` cannot know better.
 */
function merged(defaults: TLankaHttpDefaultHeaders, own: HeadersInit | undefined): Headers {
	const result = new Headers();

	for (const [name, value] of Object.entries(defaults)) {
		if (value !== undefined) result.set(name, value);
	}

	// `Headers` normalises the name, so a default written `Accept` and a call
	// writing `accept` are the same header and the call replaces it — rather than
	// both being sent and the server picking one.
	new Headers(own).forEach((value, name) => result.set(name, value));

	return result;
}
