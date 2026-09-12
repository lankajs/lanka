import type { ILankaReadCache } from "lanka/cache";
import type { PlaygroundOrderGateway } from "../playground-order-gateway/PlaygroundOrderGateway";
import type { IPlaygroundOrder } from "../_interfaces/IPlaygroundOrder";

/** What the optimistic save is handed. */
export interface IPlaygroundRenameContext {
	cache: ILankaReadCache;
	orderGateway: PlaygroundOrderGateway;
	orders: () => IPlaygroundOrder[];
	set: (state: { screenError: string | null }) => void;
}

/**
 * An optimistic rename, written into the CACHE rather than into one screen.
 *
 * With a cache underneath, the cache is the truth about the resource: writing
 * the guess there shows it on every screen reading the key at once, and the
 * snapshot for the rollback comes from the same place. Writing it into one
 * ViewModel's state would leave the other screen showing the old name until
 * something refetched.
 */
export const renamePlaygroundOrder = async (
	{ cache, orderGateway, orders, set }: IPlaygroundRenameContext,
	id: number,
	customer: string,
): Promise<void> => {
	const snapshot = orders();
	cache.write(
		["orders"],
		snapshot.map((order) => (order.id === id ? { ...order, customer } : order)),
	);

	try {
		const saved = await orderGateway.rename(id, customer);
		cache.write(
			["orders"],
			orders().map((order) => (order.id === id ? saved : order)),
		);
		cache.write(["order", id], saved);
	} catch (error) {
		cache.write(["orders"], snapshot);
		set({ screenError: error instanceof Error ? error.message : "unknown" });
	}
};
