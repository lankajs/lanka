import { defineLankaPrefetchResource } from "../../src/index";

/**
 * One thing a screen needs, declared once.
 *
 * A resource is the unit of prefetching rather than a bare key: the id groups
 * everything derived from it — so invalidating an order drops every order — and
 * `identify` builds the SAME key for the warm and for the claim, which is what
 * makes a claim able to find anything at all.
 */
export const playgroundOrderResource = defineLankaPrefetchResource<{ id: number }>({
	id: "order",
	domain: "orders",
	identify: (params) => String(params.id),
	fetch: (params) => Promise.resolve({ id: Number(params.id) }),
});
