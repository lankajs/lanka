import { lankaGateways } from "lanka/locator";
import { runLankaStatic } from "@lankajs/host/server";
import { atlasApiBaseUrl } from "./atlasApiBaseUrl";
import type { IAtlasMission } from "@lanka-playgrounds/_shared";

/**
 * The board, read at BUILD time, for a route nobody is waiting on.
 *
 * `runLankaStatic` and not `runLankaRequest`, and the difference is a refusal:
 * a prerender has no caller, so there are no headers to forward — and a scope
 * that accepted them would let a build bake ONE user's session into a page
 * every user is then served.
 *
 * That is why the two are separate names rather than one with a flag. A flag is
 * a thing somebody passes wrongly; a missing parameter is a thing that does not
 * compile.
 *
 * Angular's own prerender (`ng build --prerender`, or an adapter's static pass)
 * calls the render path with no request, and this is the call that belongs
 * under it.
 */
export const prerenderAtlasMissions = (): Promise<IAtlasMission[]> =>
	runLankaStatic({ apiBaseUrl: atlasApiBaseUrl() }, () =>
		lankaGateways.atlasMissionGateway.list(),
	);
