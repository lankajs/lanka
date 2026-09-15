import { lankaGateways } from "lanka/locator";
import { runLankaRequest } from "@lankajs/host/server";
import { atlasApiBaseUrl } from "./atlasApiBaseUrl";
import type { IAtlasMission } from "@lanka-playgrounds/_shared";
import type { IncomingHttpHeaders } from "node:http";

/**
 * Node's headers, as the host layer takes them.
 *
 * `IncomingHttpHeaders` allows `string[]` — node gives an array for a header
 * sent more than once, `set-cookie` above all — and the forwarding layer takes
 * one string per name. Joining with `, ` is what the HTTP field-value grammar
 * says two lines of one header mean, so nothing is chosen here that the protocol
 * had not already decided.
 */
const asForwardable = (headers: IncomingHttpHeaders): Record<string, string | undefined> =>
	Object.fromEntries(
		Object.entries(headers).map(([name, value]) => [
			name,
			Array.isArray(value) ? value.join(", ") : value,
		]),
	);

/**
 * The board, read for ONE caller, against an instance nobody else can see.
 *
 * The same call the Next application makes from a server component, made here
 * from a bare `node:http` handler — which is the claim this playground exists
 * for. `runLankaRequest` is not a Next integration: it is `AsyncLocalStorage`,
 * and every server that has a request has one.
 *
 * The headers cross because identity does. Without them the service answers as
 * whoever the process last signed in as, which on a machine serving two tenants
 * is not a subtle bug.
 *
 * Note what is NOT here: a ViewModel. One store per process is right for a
 * browser tab and wrong for a server, so a request fetches through the gateway
 * and hands the DATA back. The ViewModel in this package is watched by the
 * process itself, which has exactly one of them on purpose.
 */
export const readAtlasMissionsForRequest = (
	headers: IncomingHttpHeaders,
): Promise<IAtlasMission[]> =>
	runLankaRequest({ apiBaseUrl: atlasApiBaseUrl(), headers: asForwardable(headers) }, () =>
		lankaGateways.atlasMissionGateway.list(),
	);
