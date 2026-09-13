import { sendAtlasJson } from "../../routing/send-atlas-json/sendAtlasJson";
import type { AtlasSessions } from "../../atlas-sessions/AtlasSessions";
import type { IAtlasCall } from "../../_interfaces/IAtlasRoute";

/**
 * Requires proof that an unsafe request came from the application.
 *
 * Asked of a COOKIE caller only, and that is the whole rule rather than an
 * optimisation: a browser attaches a cookie to a request from somebody else's
 * page by itself and will not attach a header, so a cookie session needs a proof
 * the application put there. Nothing attaches a bearer token to a stranger's
 * request, so demanding one from a header caller would be proving what the token
 * already proves — which is exactly the difference between the two presets in
 * `@lankajs/plugin-http`, and a server that demanded it from everybody would
 * make the wrong one look necessary.
 *
 * Unsafe methods only. GET and HEAD change nothing, and requiring the header on
 * them breaks link navigation for imaginary protection.
 *
 * 403 rather than 401: the caller is who they say they are, and signing in again
 * would not help. Telling somebody to re-authenticate for a missing header sends
 * them round a loop that cannot end.
 */
export const requireAtlasCsrf = (call: IAtlasCall, sessions: AtlasSessions): boolean => {
	const header = call.request.headers["x-atlas-csrf"];
	const value = Array.isArray(header) ? header[0] : header;

	if (sessions.bearing(value)) return true;

	sendAtlasJson(call.response, 403, {
		code: "CSRF_MISSING",
		detail: "an unsafe request carries x-atlas-csrf",
	});

	return false;
};
