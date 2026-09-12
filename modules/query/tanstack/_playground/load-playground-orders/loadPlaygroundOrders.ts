import type { ILankaReadCache } from "lanka/cache";
import type { PlaygroundOrderGateway } from "../playground-order-gateway/PlaygroundOrderGateway";
import type { IPlaygroundOrder } from "../_interfaces/IPlaygroundOrder";

/** What the list action is handed: the two things it needs and nothing else. */
export interface IPlaygroundLoadContext {
	cache: ILankaReadCache;
	orderGateway: PlaygroundOrderGateway;
	set: (
		state: Partial<{
			orders: IPlaygroundOrder[];
			isLoading: boolean;
			screenError: string | null;
		}>,
	) => void;
}

/**
 * The list, read through the cache.
 *
 * The cache decides whether this becomes a request: a fresh answer comes from
 * memory, and a second screen asking for the same key joins the one in flight.
 * The gateway is called exactly as a screen without a cache would call it — the
 * `signal` travels as an ordinary request option.
 */
export const loadPlaygroundOrders = async ({
	cache,
	orderGateway,
	set,
}: IPlaygroundLoadContext): Promise<void> => {
	set({ isLoading: true, screenError: null });
	try {
		set({
			orders: await cache.read(["orders"], (signal) => orderGateway.list({ signal }), {
				staleMs: 30_000,
			}),
		});
	} catch (error) {
		set({ screenError: error instanceof Error ? error.message : "unknown" });
	} finally {
		set({ isLoading: false });
	}
};
