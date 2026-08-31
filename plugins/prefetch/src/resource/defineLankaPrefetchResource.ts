/**
 * Route params exactly as loaders receive them.
 *
 * Strings, with parsing inside the resource (`Number(params.id)`). That lets a
 * claimer use THE SAME object the router gave it: there is no intermediate
 * transform in which the warming key and the claiming key could diverge.
 */
export type TLankaRouteParams = Record<string, string>;

/** One payload that can be fetched a beat before it is needed. */
export interface ILankaPrefetchResource<TValue> {
	/** Stable identifier: the buffer key prefix and the label in the log. */
	id: string;

	/**
	 * Params → key suffix. Every param that changes the response must appear here,
	 * or two screens will claim each other's data.
	 */
	identify: (params: TLankaRouteParams) => string;

	/** How long the response counts as fresh. Defaults to the configured TTL. */
	ttlMs?: number;

	/**
	 * Which freshness fence this payload sits behind.
	 *
	 * A live event in that domain makes every older entry of the domain UNUSABLE:
	 * the claimer then fetches for itself and gets the truth after the event. That
	 * is the buffer's whole safety model — it serves only what no event overtook,
	 * and when in doubt serves nothing.
	 */
	domain: string;

	/**
	 * A BARE request. It must not write to a ViewModel, raise a loading flag, set
	 * an error or send analytics: the user did not open this screen and may never
	 * open it.
	 *
	 * Filling state stays with whoever claims the value. That is the point of a
	 * buffer: nothing is written speculatively into a single-slot ViewModel, so
	 * warming one entity while another is open can neither evict what is on screen
	 * nor leave a stale value behind.
	 */
	fetch: (params: TLankaRouteParams) => Promise<TValue>;
}

/**
 * An identity helper: it exists so a declaration reads as a declaration and
 * infers `TValue` from `fetch` without a manual type parameter.
 */
export const defineLankaPrefetchResource = <TValue>(
	resource: ILankaPrefetchResource<TValue>,
): ILankaPrefetchResource<TValue> => resource;
