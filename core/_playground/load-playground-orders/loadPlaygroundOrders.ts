import { sortPlaygroundFailure } from "../sort-playground-failure/sortPlaygroundFailure";
import type { TPlaygroundOrdersContext } from "../_types/TPlaygroundOrdersContext";

/**
 * The list, read through the cache.
 *
 * The cache decides whether this becomes a request: a fresh answer comes from
 * memory, and a second screen asking for the same key joins the one in flight.
 * A list has no input to show an addressed failure at, so whatever goes wrong
 * becomes the screen's.
 */
export const loadPlaygroundOrders = async ({
	set,
	gateways,
	services,
}: TPlaygroundOrdersContext): Promise<void> => {
	set({ isLoading: true, screenError: null });
	try {
		const orders = await services.cache.read(
			["orders"],
			(signal) => gateways.orderGateway.list({ signal }),
			{ staleMs: 30_000 },
		);
		set({ orders });
	} catch (error) {
		sortPlaygroundFailure(error, (message) => set({ screenError: message }));
	} finally {
		set({ isLoading: false });
	}
};
