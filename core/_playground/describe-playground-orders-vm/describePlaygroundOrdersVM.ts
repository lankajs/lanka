import { renamePlaygroundOrder } from "../rename-playground-order/renamePlaygroundOrder";
import { sortPlaygroundFailure } from "../sort-playground-failure/sortPlaygroundFailure";
import type { ILankaVMConfig } from "../../src/viewmodel/index";
import type { PlaygroundOrderGateway } from "../playground-order-gateway/PlaygroundOrderGateway";
import type { IPlaygroundOrder } from "../_interfaces/IPlaygroundOrder";
import type { IPlaygroundOrderGateways } from "../_interfaces/IPlaygroundOrderGateways";
import type { IPlaygroundOrdersActions } from "../_interfaces/IPlaygroundOrdersActions";
import type { IPlaygroundOrdersServices } from "../_interfaces/IPlaygroundOrdersServices";
import type { IPlaygroundOrdersState } from "../_interfaces/IPlaygroundOrdersState";
import type { IPlaygroundReadCache } from "../_interfaces/IPlaygroundReadCache";
import type { IPlaygroundSubscription } from "../_interfaces/IPlaygroundSubscription";

/**
 * Configuration three: lanka and a read cache. The list, declared once.
 *
 * A declaration rather than a built ViewModel so the eager and the lazy form
 * are the same text: `createLankaVM` and `createLazyLankaVM` take it as it is.
 *
 * No `scenarioHandlers`. This screen hears about the resource through the
 * cache — it is a READER, and a reader with a cache underneath needs no fact
 * from anyone: whoever saves writes the cache, and the cache tells every
 * listener. The two lifecycle hooks are the whole seam: hear in `onInit`, stop
 * hearing in `onReset`. A ViewModel with these two and no scenarios is exactly
 * the one bootstrap used to skip, which is why this configuration did not exist
 * before the hooks were made to run on their own.
 */
export const describePlaygroundOrdersVM = (
	orderGateway: PlaygroundOrderGateway,
	cache: IPlaygroundReadCache,
	name: string,
): ILankaVMConfig<
	IPlaygroundOrdersState,
	IPlaygroundOrdersActions,
	IPlaygroundOrderGateways,
	IPlaygroundOrdersServices
> => {
	const held: IPlaygroundSubscription = { release: null };

	return {
		name,
		gateways: () => ({ orderGateway }),
		services: () => ({ cache }),
		states: { orders: [], isLoading: false, screenError: null },

		createActions: (context) => ({
			load: async () => {
				const { gateways, services, set } = context;
				set({ isLoading: true, screenError: null });
				try {
					// The cache decides whether this becomes a request: fresh is
					// answered from memory, and a second reader joins one in flight.
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
			},
			rename: (id, customer) => renamePlaygroundOrder(context, id, customer),
		}),

		onInit: ({ set, services }) => {
			held.release = services.cache.subscribe(["orders"], (data) => {
				set({ orders: data as IPlaygroundOrder[] });
			});
		},

		onReset: ({ services }) => {
			held.release?.();
			held.release = null;
			services.cache.cancel(["orders"]);
		},
	};
};
