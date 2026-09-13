import { sendAtlasJson } from "../../routing/send-atlas-json/sendAtlasJson";
import type { IAtlasRoute } from "../../_interfaces/IAtlasRoute";

/**
 * How the build identifies itself to the release guard.
 *
 * Module-private: nobody imports this, because the only reader is a client that
 * FETCHES it. A value exported for a test to compare against would be the test
 * asserting a constant equals itself.
 */
const BUILD_VERSION = "2026.09.13-1";

const MAX_SLEEP_MS = 5_000;

const sleep = (ms: number): Promise<void> =>
	new Promise((resolve) => {
		setTimeout(resolve, ms);
	});

/**
 * The routes that exist to FAIL, on purpose and on a schedule.
 *
 * A retry policy, a deadline and a release guard cannot be exercised against a
 * server that always answers correctly and quickly. These three are the smallest
 * honest version of "the network is not always fine":
 *
 * - `/unstable` fails a stated number of times and then works, which is the
 *   shape a retry is worth having for — and the failures are 503, the status
 *   that means "could not", not "would not".
 * - `/slow` takes as long as it is asked to, so a deadline has something to cut.
 * - `/build-manifest.json` names a version, so a returning visitor's caches can
 *   be noticed as belonging to a build that no longer exists.
 */
export const createAtlasProbeRoutes = (): readonly IAtlasRoute[] => {
	const failuresLeft = new Map<string, number>();

	return Object.freeze([
		{
			method: "GET",
			path: "/unstable",
			run: ({ response, query }) => {
				const run = query.get("run") ?? "default";
				const wanted = Number(query.get("failures") ?? "1");
				const left = failuresLeft.get(run) ?? wanted;

				if (left > 0) {
					failuresLeft.set(run, left - 1);
					return sendAtlasJson(response, 503, { code: "TRY_AGAIN", left: left - 1 });
				}

				failuresLeft.delete(run);
				sendAtlasJson(response, 200, { run, attemptsBeforeSuccess: wanted });
			},
		},
		{
			method: "GET",
			path: "/slow",
			run: async ({ response, query }) => {
				// A ceiling, because a request that sleeps for an hour is a request
				// the test suite waits an hour for.
				const ms = Math.min(Number(query.get("ms") ?? "1000"), MAX_SLEEP_MS);
				await sleep(ms);

				sendAtlasJson(response, 200, { sleptMs: ms });
			},
		},
		{
			method: "GET",
			path: "/build-manifest.json",
			run: ({ response }) => {
				sendAtlasJson(response, 200, { version: BUILD_VERSION });
			},
		},
	] satisfies IAtlasRoute[]);
};
