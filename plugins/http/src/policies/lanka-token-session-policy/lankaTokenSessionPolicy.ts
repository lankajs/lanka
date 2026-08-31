import { lankaSessionDefaults } from "../lanka-session-defaults/lankaSessionDefaults";
import type { ILankaHttpConfig } from "../../_interfaces/ILankaHttpConfig";
import type { ILankaHttpAuthConfig } from "../../auth-middleware/authMiddleware";

/** What a token session needs that nothing can guess. */
export interface ILankaTokenSessionOptions {
	/** One refresh attempt per 401, and what to do when it fails. */
	auth: ILankaHttpAuthConfig;
	/** Anything above, replaced. Spread last, so a consumer always wins. */
	overrides?: ILankaHttpConfig;
}

/**
 * A request policy for a session carried in a header.
 *
 * No CSRF header, and that is the whole difference: nothing attaches a bearer
 * token to a request from someone else's page, so proving the request came from
 * this application would be proving what the token already proves.
 *
 * The refresh is required rather than optional here. A token expires on a
 * schedule; a policy without a refresh turns that schedule into a sign-out.
 */
export const lankaTokenSessionPolicy = (options: ILankaTokenSessionOptions): ILankaHttpConfig => ({
	...lankaSessionDefaults(),
	auth: options.auth,
	...options.overrides,
});
