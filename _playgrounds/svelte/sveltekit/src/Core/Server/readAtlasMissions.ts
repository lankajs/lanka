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
 * The same call `_playgrounds/react/next` makes from a server component and
 * `_playgrounds/vue/nuxt` makes from a Nitro route, made here from a Kit `load`
 * — which is the whole reason a third server host exists. `@lankajs/host` is a
 * seam, not an adapter for whoever came first: every server that has a request
 * has `AsyncLocalStorage`, and Kit's `load` hands over a real `Request`.
 */
export const readAtlasMissions = (headers: TLankaIncomingHeaders): Promise<IAtlasMission[]> =>
	runLankaRequest({ apiBaseUrl: atlasApiBaseUrl(), headers }, () =>
		lankaGateways.atlasMissionGateway.list(),
	);
