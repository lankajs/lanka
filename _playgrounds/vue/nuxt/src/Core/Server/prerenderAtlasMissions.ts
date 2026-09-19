import { lankaGateways } from "lanka/locator";
import { runLankaStatic } from "@lankajs/host/server";
import { atlasApiBaseUrl } from "./atlasApiBaseUrl";
import { keepPrerenderedMissions, readPrerenderedMissions } from "./atlasPrerenderStore";
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
 * ## Why this one may remember its answer and the request path may not
 *
 * A build prerenders many routes and every one of them wants the same board. The
 * store behind `atlasPrerenderStore` holds it for the rest of the build, so a
 * hundred routes cost one request instead of a hundred.
 *
 * That is safe HERE and nowhere else, and the reason is the refusal above: with
 * no caller there is no "whose" to get wrong. `readAtlasMissions` runs inside a
 * scope carrying a cookie, and a store that remembered its answer would serve
 * the first visitor's board to the second — which is why it has no access to
 * this one.
 */
export const prerenderAtlasMissions = async (): Promise<IAtlasMission[]> => {
	const held = await readPrerenderedMissions();

	if (held) return held;

	const missions = await runLankaStatic({ apiBaseUrl: atlasApiBaseUrl() }, () =>
		lankaGateways.atlasMissionGateway.list(),
	);

	await keepPrerenderedMissions(missions);

	return missions;
};
