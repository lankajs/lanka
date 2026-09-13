import { authorizeAtlasCall } from "../authorize-atlas-call/authorizeAtlasCall";
import { sendAtlasJson } from "../../routing/send-atlas-json/sendAtlasJson";
import type { IAtlasApi } from "../../_interfaces/IAtlasApi";
import type { IAtlasRoute } from "../../_interfaces/IAtlasRoute";

const nameIn = (body: unknown): string => {
	const given = (body as { name?: unknown } | null)?.name;

	return typeof given === "string" && given.trim().length > 0 ? given.trim() : "Guest";
};

const refreshTokenIn = (body: unknown): string | undefined => {
	const given = (body as { refreshToken?: unknown } | null)?.refreshToken;

	return typeof given === "string" ? given : undefined;
};

/**
 * Signing in, refreshing, and asking who you are.
 *
 * Three routes that exist so a client's request policy has something real to be
 * right about: tokens here genuinely expire, a refresh genuinely rotates, and a
 * spent token is genuinely gone.
 */
export const createAtlasSessionRoutes = (api: IAtlasApi): readonly IAtlasRoute[] =>
	Object.freeze([
		{
			method: "POST",
			path: "/session",
			run: ({ response, body }) => {
				const session = api.sessions.open(nameIn(body));

				sendAtlasJson(
					response,
					201,
					{
						token: session.token,
						refreshToken: session.refreshToken,
						csrf: session.csrf,
						name: session.name,
					},
					// The SAME session, reachable two ways, so one server can serve a
					// token client and a cookie client — which is what makes the
					// difference between the two request policies visible rather than
					// theoretical. `SameSite=Lax` because the cookie must not travel on
					// a cross-site POST at all; the CSRF header is the second lock.
					{ "set-cookie": `atlas_session=${session.token}; Path=/; SameSite=Lax` },
				);
			},
		},
		{
			method: "POST",
			path: "/session/refresh",
			run: ({ response, body }) => {
				const session = api.sessions.refresh(refreshTokenIn(body));

				if (!session) {
					// 401 and not 403: the caller may still sign in, which is a
					// different instruction from "you may not do this".
					sendAtlasJson(response, 401, { code: "REFRESH_REJECTED" });
					return;
				}

				sendAtlasJson(response, 200, {
					token: session.token,
					refreshToken: session.refreshToken,
					csrf: session.csrf,
					name: session.name,
				});
			},
		},
		{
			method: "GET",
			path: "/me",
			run: (call) => {
				const caller = authorizeAtlasCall(call, api.sessions);
				if (!caller) return;

				sendAtlasJson(call.response, 200, {
					name: caller.session.name,
					callsLeft: caller.session.callsLeft,
					viaCookie: caller.viaCookie,
				});
			},
		},
	] satisfies IAtlasRoute[]);
