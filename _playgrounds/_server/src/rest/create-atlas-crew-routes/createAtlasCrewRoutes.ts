import { atlasCorsHeaders } from "../../routing/atlas-cors-headers/atlasCorsHeaders";
import { createAtlasAvatar } from "../../png/create-atlas-avatar/createAtlasAvatar";
import { sendAtlasJson } from "../../routing/send-atlas-json/sendAtlasJson";
import type { IAtlasApi } from "../../_interfaces/IAtlasApi";
import type { IAtlasRoute } from "../../_interfaces/IAtlasRoute";

/**
 * The crew, and their faces.
 *
 * The avatar route is the only one here that answers bytes rather than JSON, and
 * it says `immutable` out loud: a cache that never checks freshness may only be
 * pointed at something that cannot change, and a server that did not promise
 * that would be inviting a permanently stale image.
 */
export const createAtlasCrewRoutes = (api: IAtlasApi): readonly IAtlasRoute[] =>
	Object.freeze([
		{
			method: "GET",
			path: "/crew",
			run: ({ response }) => {
				sendAtlasJson(response, 200, api.world.crew());
			},
		},
		{
			method: "GET",
			path: "/crew/:crewId/avatar.png",
			run: ({ response, params }) => {
				const png = createAtlasAvatar(params.crewId);

				response.writeHead(200, {
					"content-type": "image/png",
					"content-length": String(png.length),
					"cache-control": "public, max-age=31536000, immutable",
					...atlasCorsHeaders(response.req.headers.origin),
				});
				response.end(png);
			},
		},
	] satisfies IAtlasRoute[]);
