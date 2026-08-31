import type { ILankaTransport } from "lanka/gateway";

/** The stub server, and what it saw. */
export interface IPlaygroundApi {
	readonly transport: ILankaTransport<RequestInit>;
	/** Every set of headers the API was called with, in order. */
	readonly seen: readonly (Record<string, unknown> | undefined)[];
	/** How many times anything asked it for anything. */
	readonly calls: () => number;
	/**
	 * A status to answer with instead of the posts.
	 *
	 * Mutable, because a scene sets it between calls: "the API was fine and then
	 * was not" is the shape a page has to survive, and a second stub for the
	 * failing case would be a second server to keep in step with this one.
	 */
	failWith?: number;
}
