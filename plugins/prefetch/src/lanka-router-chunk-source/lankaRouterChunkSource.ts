import type { ILankaChunkEntry } from "../lanka-chunk-preload/LankaChunkPreload";

/**
 * One route, as every popular router already describes it.
 *
 * The shape is the intersection on purpose: a path, an optional weight, and the
 * dynamic import that fetches the screen. TanStack Router, React Router and a
 * hand-written map all have these three, and none of them has to be named here.
 */
export interface ILankaRouteManifestEntry {
	/** The route's path pattern, which is also the chunk's identity. */
	path: string;
	/**
	 * Loads the CHUNK and nothing else.
	 *
	 * Deliberately not the router's own `preloadRoute`: that runs `beforeLoad`
	 * and the loader, which in an application seed state, send analytics and call
	 * the server. Router-level prefetch produces phantom screen views, phantom
	 * requests and a corrupted funnel.
	 */
	load: () => Promise<unknown>;
	/** Higher sweeps first. Absent means "as important as the rest". */
	priority?: number;
}

export interface ILankaRouterChunkSourceOptions {
	/**
	 * Paths never swept, by pattern.
	 *
	 * What belongs here: the screen the user is already on, and anything behind a
	 * permission most visitors do not have — warming a chunk nobody may open is
	 * bandwidth spent on nobody's behalf.
	 */
	exclude?: readonly string[];
	/** The weight of an entry that names none. */
	defaultPriority?: number;
}

/**
 * Turns a route manifest into the source the chunk sweeper reads.
 *
 * The package stays router-agnostic — `setSource` is the seam, and it takes a
 * function rather than a list because routes appear later than the service. This
 * removes the assembly work from the consumer without moving the router choice
 * into the plugin: it takes the SHAPE every router already has, and an
 * application on a router nobody anticipated writes the same three fields.
 *
 * Shipped as its own entry (`@lankajs/plugin-prefetch/router`) so an application
 * that supplies its own source never loads it.
 */
export const lankaRouterChunkSource = (
	routes: () => readonly ILankaRouteManifestEntry[],
	options: ILankaRouterChunkSourceOptions = {},
): (() => readonly ILankaChunkEntry[]) => {
	const excluded = new Set(options.exclude ?? []);
	const fallback = options.defaultPriority ?? 0;

	return () =>
		routes()
			.filter((route) => !excluded.has(route.path))
			.map((route) => ({
				path: route.path,
				priority: route.priority ?? fallback,
				preload: route.load,
			}));
};
