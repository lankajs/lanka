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
 * `vite build` with a static pass over it calls this, and `vite dev` never does.
 * Solid reaches the same seam as the four meta-frameworks without one of its
 * own, which is the reason this ecosystem has a server half at all.
 *
 * ## Why this one may remember its answer and the request path may not
 *
 * A build renders many routes and every one of them wants the same board, so the
 * store behind `atlasPrerenderStore` holds it until the build ends: a hundred
 * routes cost one request rather than a hundred.
 *
 * Safe HERE and nowhere else, for the reason above. With no caller there is no
 * "whose" to get wrong; `readAtlasMissions` runs inside a scope carrying a
 * cookie, and a store in front of it would serve the first visitor's board to
 * the second — which is why that file cannot reach this one.
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
