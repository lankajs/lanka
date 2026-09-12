import { createLankaVM } from "lanka/viewmodel";
import type { ILankaReadCache } from "lanka/cache";
import type { PlaygroundOrderGateway } from "../playground-order-gateway/PlaygroundOrderGateway";
import type { IPlaygroundOrder } from "../_interfaces/IPlaygroundOrder";

interface IOrdersState {
	orders: IPlaygroundOrder[];
	isLoading: boolean;
	screenError: string | null;
}

interface IOrdersActions {
	load: () => Promise<void>;
	/** Optimistic: the list shows the new name at once, and takes it back if the server refuses. */
	rename: (id: number, customer: string) => Promise<void>;
}

/**
 * A screen that reads the list, and the shape this package is FOR.
 *
 * Two of these over one cache are two screens reading one resource — and one
 * request. That is the whole reason a cache sits under the ViewModel rather than
 * inside the gateway: the gateway answers, and whoever called decides what to
 * remember.
 *
 * No `scenarioHandlers`. A reader with a cache underneath hears about the
 * resource through the cache: whoever saves writes it, and the cache tells every
 * listener. The two lifecycle hooks are the whole seam — hear in `onInit`, stop
 * hearing in `onReset` — and a ViewModel with those and no scenarios is exactly
 * the one bootstrap used to skip.
 */
export const createPlaygroundOrdersVM = (
	orderGateway: PlaygroundOrderGateway,
	cache: ILankaReadCache,
	name = "PlaygroundOrdersVM",
) => {
	let release: (() => void) | null = null;

	return createLankaVM<
		IOrdersState,
		IOrdersActions,
		{ orderGateway: PlaygroundOrderGateway },
		{ cache: ILankaReadCache }
	>({
		name,
		gateways: () => ({ orderGateway }),
		services: () => ({ cache }),
		states: { orders: [], isLoading: false, screenError: null },

		createActions: ({ set, get, gateways, services }) => ({
			load: async () => {
				set({ isLoading: true, screenError: null });
				try {
					// The cache decides whether this becomes a request: fresh is answered
					// from memory, and a second reader joins one already in flight.
					set({
						orders: await services.cache.read(
							["orders"],
							(signal) => gateways.orderGateway.list({ signal }),
							{ staleMs: 30_000 },
						),
					});
				} catch (error) {
					set({ screenError: error instanceof Error ? error.message : "unknown" });
				} finally {
					set({ isLoading: false });
				}
			},

			rename: async (id, customer) => {
				// The guess goes into the CACHE, not into this ViewModel's state: with a
				// cache underneath, the cache is the truth about the resource and every
				// screen reading it shows the guess at once.
				const snapshot = get().orders;
				services.cache.write(
					["orders"],
					snapshot.map((order) => (order.id === id ? { ...order, customer } : order)),
				);

				try {
					const saved = await gateways.orderGateway.rename(id, customer);
					services.cache.write(
						["orders"],
						get().orders.map((order) => (order.id === id ? saved : order)),
					);
					services.cache.write(["order", id], saved);
				} catch (error) {
					services.cache.write(["orders"], snapshot);
					set({ screenError: error instanceof Error ? error.message : "unknown" });
				}
			},
		}),

		onInit: ({ set, services }) => {
			release = services.cache.subscribe(["orders"], (data) => {
				set({ orders: data as IPlaygroundOrder[] });
			});
		},

		onReset: ({ services }) => {
			release?.();
			release = null;
			services.cache.cancel?.(["orders"]);
		},
	});
};
