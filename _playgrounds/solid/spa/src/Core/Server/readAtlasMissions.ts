import { lankaGateways } from "lanka/locator";
import { runLankaRequest } from "@lankajs/host/server";
import { atlasApiBaseUrl } from "./atlasApiBaseUrl";
import type { IAtlasMission } from "@lanka-playgrounds/_shared";
import type { TLankaIncomingHeaders } from "@lankajs/host/server";

/**
 * The board, read on the server for a user who is waiting.
 *
 * `runLankaRequest` gives this unit of work its own framework instance, so two
 * overlapping requests never share a bus, a locator cache or a mock-mode flag —
 * and it forwards the caller's `cookie` and `authorization` into the API call.
 * Without those the page renders signed out and then flips signed in when the
 * browser fetches with the cookie it always had, and nothing errors.
 *
 * The same call the Next, Nuxt, Kit, Astro and Angular applications make. A
 * sixth host making it unchanged is what "seam" means — and this one is reached
 * without a meta-framework under it at all, which is the claim only Solid is in
 * a position to make here.
 */
export const readAtlasMissions = (headers: TLankaIncomingHeaders): Promise<IAtlasMission[]> =>
	runLankaRequest({ apiBaseUrl: atlasApiBaseUrl(), headers }, () =>
		lankaGateways.atlasMissionGateway.list(),
	);
