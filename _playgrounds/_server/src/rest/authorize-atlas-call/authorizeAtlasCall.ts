import { sendAtlasJson } from "../../routing/send-atlas-json/sendAtlasJson";
import type { AtlasSessions, IAtlasSession } from "../../atlas-sessions/AtlasSessions";
import type { IAtlasCall } from "../../_interfaces/IAtlasRoute";

/** The session a call proved, and HOW it proved it. */
export interface IAtlasCaller {
	session: IAtlasSession;
	/**
	 * The token came from a cookie rather than from a header.
	 *
	 * The one thing about a caller that changes what else is required of them: a
	 * browser attaches a cookie to a request from somebody else's page by itself
	 * and will not attach a header, so a cookie caller must prove the request came
	 * from this application and a bearer caller has already proved it.
	 */
	viaCookie: boolean;
}

const bearerOf = (header: string | undefined): string | undefined =>
	header?.startsWith("Bearer ") === true ? header.slice("Bearer ".length) : undefined;

/** The session cookie, out of a header that holds every cookie there is. */
const cookieOf = (header: string | undefined): string | undefined =>
	header
		?.split(";")
		.map((pair) => pair.trim())
		.find((pair) => pair.startsWith("atlas_session="))
		?.slice("atlas_session=".length);

/**
 * Spends one call of the caller's token, or refuses with a 401 and says why.
 *
 * `null` means the refusal has already been written, so a route reads
 * `if (!caller) return;` and nothing further has to be remembered. A guard that
 * only ANSWERED whether the call was allowed would leave every route to write
 * the same four lines, and one of them eventually differently.
 *
 * The body carries `code`, because a client branches on the reason: a refresh is
 * the right answer to an expired token and the wrong answer to a forged one.
 */
export const authorizeAtlasCall = (
	call: IAtlasCall,
	sessions: AtlasSessions,
): IAtlasCaller | null => {
	const bearer = bearerOf(call.request.headers.authorization);
	const cookie = cookieOf(call.request.headers.cookie);

	// The header wins. A browser sends the cookie whether or not anybody meant it
	// to, so a caller that took the trouble to set a header is the one who said
	// what they intended.
	const session = sessions.spend(bearer ?? cookie);
	if (session) return { session, viaCookie: bearer === undefined };

	sendAtlasJson(call.response, 401, {
		code: "TOKEN_EXPIRED",
		detail: "this token is spent — refresh it and try again",
	});

	return null;
};
