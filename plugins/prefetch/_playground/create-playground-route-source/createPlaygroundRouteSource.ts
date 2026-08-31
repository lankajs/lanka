import type { ILankaRouteManifestEntry } from "../../src/lanka-router-chunk-source/lankaRouterChunkSource";

/** The application's route manifest, and a record of which chunks were pulled. */
export interface IPlaygroundRouteSource {
	source: () => ILankaRouteManifestEntry[];
	/** Every route chunk the sweeper actually pulled, in order. */
	pulled: string[];
}

/**
 * Two routes of different importance, so the ORDER is observable.
 *
 * One route would prove a sweep happens; it takes two to prove the sweep
 * respects priority, and priority is the only thing this rung decides.
 *
 * Written in the shape a ROUTER hands over — path, weight, dynamic import — not
 * in the sweeper's own, because that is what an application actually has.
 */
export const createPlaygroundRouteSource = (): IPlaygroundRouteSource => {
	const pulled: string[] = [];
	const route = (path: string, priority: number): ILankaRouteManifestEntry => ({
		path,
		priority,
		load: () => {
			pulled.push(path);
			return Promise.resolve();
		},
	});

	// Higher priority sweeps FIRST — the source is sorted descending.
	return { pulled, source: () => [route("/orders", 2), route("/profile", 1)] };
};
