import { playgroundOrderUpdated } from "../playground-order-updated/PlaygroundOrderUpdated";
import { sortPlaygroundFailure } from "../sort-playground-failure/sortPlaygroundFailure";
import type { TPlaygroundOrdersContext } from "../_types/TPlaygroundOrdersContext";

/**
 * An optimistic save from the list.
 *
 * The guess is written into the CACHE, not into this ViewModel's state: with a
 * cache underneath, the cache is the truth about the resource and every screen
 * reading it — this one included — hears the guess through its subscription.
 * The snapshot for the rollback is taken from the same place. A list has no
 * input to show an addressed failure at, so a refused line becomes the banner.
 */
export const renamePlaygroundOrder = async (
	{ get, set, gateways, services, trigger }: TPlaygroundOrdersContext,
	id: number,
	customer: string,
): Promise<void> => {
	const snapshot = get().orders;
	const current = snapshot.find((order) => order.id === id);
	if (!current) return;

	services.cache.write(
		["orders"],
		snapshot.map((order) => (order.id === id ? { ...order, customer } : order)),
	);

	try {
		const saved = await gateways.orderGateway.update(
			id,
			{ customer, items: current.items },
			{ expectedUpdatedAt: current.updatedAt },
		);
		services.cache.write(
			["orders"],
			get().orders.map((order) => (order.id === id ? saved : order)),
		);
		trigger(playgroundOrderUpdated, { order: saved });
	} catch (error) {
		services.cache.write(["orders"], snapshot);
		const failure = sortPlaygroundFailure(error, (message) => set({ screenError: message }));
		const refused = failure.fields[0]?.message ?? failure.message;
		if (refused) set({ screenError: refused });
	}
};
