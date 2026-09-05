import { lankaSessionDefaults } from "../lanka-session-defaults/lankaSessionDefaults";
import { lankaUnsafeMethods } from "../../config/lankaUnsafeMethods";
import type { ILankaHttpConfig } from "../../_interfaces/ILankaHttpConfig";
import type { ILankaHttpAuthConfig } from "../../middleware/auth-middleware/authMiddleware";
import type { ILankaHttpDefaultsConfig } from "../../middleware/defaults-middleware/defaultsMiddleware";

/** What a cookie session needs that nothing can guess. */
export interface ILankaCookieSessionOptions {
	/** The header that proves the request came from this application. */
	csrf: { header: string; value: string; methods?: readonly string[] };
	/** One refresh attempt per 401, and what to do when it fails. */
	auth?: ILankaHttpAuthConfig;
	/**
	 * Application-wide headers, and `credentials` if `"include"` is wrong here.
	 *
	 * `"include"` is the default because a cookie session that does not send the
	 * cookie is not a session. Same-origin deployments may narrow it.
	 */
	defaults?: ILankaHttpDefaultsConfig;
	/** Anything above, replaced. Spread last, so a consumer always wins. */
	overrides?: ILankaHttpConfig;
}

/**
 * A request policy for a session that lives in cookies.
 *
 * The one thing that distinguishes it: the browser attaches a cookie to a
 * request from someone else's page BY ITSELF, and will not attach a header. So
 * every unsafe method carries a proof the application put there — and GET and
 * HEAD do not, because requiring it on them breaks link navigation for
 * protection against nothing.
 *
 * And it sends the cookie. `fetch` defaults to `credentials: "same-origin"`, so
 * a front end on `app.example.com` talking to `api.example.com` — the ordinary
 * deployment — sent none. This preset used to set the CSRF header and leave that
 * alone: a proof of origin attached to an unauthenticated request. Applications
 * hit it on their first cross-origin request and fixed it where they could,
 * which was in a transport of their own.
 *
 * Everything else is `lankaSessionDefaults`. This exists to remove assembly
 * work, not to move the choice inside the package: the result is an ordinary
 * config object, and `overrides` beats every line of it.
 */
export const lankaCookieSessionPolicy = (
	options: ILankaCookieSessionOptions,
): ILankaHttpConfig => ({
	...lankaSessionDefaults(),
	csrf: { methods: lankaUnsafeMethods, ...options.csrf },
	defaults: { credentials: "include", ...options.defaults },
	...(options.auth ? { auth: options.auth } : {}),
	...options.overrides,
});
