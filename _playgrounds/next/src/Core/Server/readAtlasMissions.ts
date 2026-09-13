import { lankaGateways } from "lanka/locator";
import { runLankaRequest } from "@lankajs/host/server";
import { atlasApiBaseUrl } from "./atlasApiBaseUrl";
import type { IAtlasMission } from "@lanka-playgrounds/_shared";

/**
 * The board, read on the server for a user who is waiting.
 *
 * `runLankaRequest` gives this unit of work its own framework instance, so two
 * overlapping requests never share a bus, a locator cache or a mock-mode flag —
 * and it forwards the caller's `cookie` and `authorization` into the API call.
 * Without those the page renders signed out and then flips signed in when the
 * browser fetches with the cookie it always had, and nothing errors.
 *
 * Calling a gateway here WITHOUT the scope would not be a smaller version of
 * this: the ambient facades would have no instance to resolve to and would say
 * so by name. That failure is the feature — the alternative was reading
 * whichever instance the process created last, which is another user's.
 */
export const readAtlasMissions = (headers: Headers): Promise<IAtlasMission[]> =>
	runLankaRequest({ apiBaseUrl: atlasApiBaseUrl(), headers }, () =>
		lankaGateways.atlasMissionGateway.list(),
	);
