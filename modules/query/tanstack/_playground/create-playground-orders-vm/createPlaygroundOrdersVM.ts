import { createLankaVM } from "lanka/viewmodel";
import { loadPlaygroundOrders } from "../load-playground-orders/loadPlaygroundOrders";
import { renamePlaygroundOrder } from "../rename-playground-order/renamePlaygroundOrder";
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
			load: () =>
				loadPlaygroundOrders({
					cache: services.cache,
					orderGateway: gateways.orderGateway,
					set,
				}),

			rename: (id, customer) =>
				renamePlaygroundOrder(
					{
						cache: services.cache,
						orderGateway: gateways.orderGateway,
						orders: () => get().orders,
						set,
					},
					id,
					customer,
				),
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
