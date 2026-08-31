import type { ILankaTransport } from "lanka/gateway";
import type { IPlaygroundServerScript } from "../../_interfaces/IPlaygroundServerScript";

/**
 * The wire, and the only stub in this playground.
 *
 * It records what it was given rather than asserting on it: every header this
 * package adds is invisible from above, so the transport is the only place the
 * policy's effect can be OBSERVED.
 */
export const createPlaygroundTransport = (
	script: IPlaygroundServerScript,
): ILankaTransport<RequestInit> => ({
	request(endpoint: string, options?: RequestInit) {
		script.seen.push({ endpoint, options });

		const status = script.statuses[script.seen.length - 1] ?? script.statuses.at(-1) ?? 200;
		const payload = JSON.stringify(script.body ?? { ok: true });

		return Promise.resolve(
			new Response(payload, { status, headers: { "content-type": "application/json" } }),
		);
	},
});
