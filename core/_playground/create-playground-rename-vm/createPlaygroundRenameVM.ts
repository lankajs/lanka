import { createLankaVM } from "../../src/viewmodel/index";
import { playgroundOrderUpdated } from "../playground-order-updated/PlaygroundOrderUpdated";
import { submitPlaygroundRename } from "../submit-playground-rename/submitPlaygroundRename";
import type { PlaygroundOrderGateway } from "../playground-order-gateway/PlaygroundOrderGateway";
import type { IPlaygroundOrder } from "../_interfaces/IPlaygroundOrder";
import type { IPlaygroundOrderGateways } from "../_interfaces/IPlaygroundOrderGateways";
import type { IPlaygroundRenameActions } from "../_interfaces/IPlaygroundRenameActions";
import type { IPlaygroundRenameState } from "../_interfaces/IPlaygroundRenameState";

/**
 * Configuration one: lanka alone. The inputs are state, flat, one key each.
 *
 * The handler for another screen's save writes ONLY the marker. `customer` is
 * what the person is typing, and a fact that arrived from elsewhere must not
 * overwrite it — the screen shows a banner and the person decides. That rule is
 * the same whether the inputs live here or in a form library; here it is simply
 * more tempting to break.
 */
export const createPlaygroundRenameVM = (orderGateway: PlaygroundOrderGateway) =>
	createLankaVM<IPlaygroundRenameState, IPlaygroundRenameActions, IPlaygroundOrderGateways>({
		name: "PlaygroundRenameVM",
		gateways: () => ({ orderGateway }),
		states: {
			id: null,
			customer: "",
			note: "",
			items: [],
			updatedAt: null,
			serverChangedAt: null,
			fieldErrors: [],
			screenError: null,
			isSubmitting: false,
		},

		createActions: (context) => ({
			load: async (id) => {
				const order = await context.gateways.orderGateway.byId(id);
				context.set({
					id: order.id,
					customer: order.customer,
					items: order.items,
					updatedAt: order.updatedAt,
					serverChangedAt: null,
					fieldErrors: [],
					screenError: null,
				});
			},
			setCustomer: (customer) => context.set({ customer, fieldErrors: [] }),
			setNote: (note) => context.set({ note }),
			submit: () => submitPlaygroundRename(context),
		}),

		scenarioHandlers: [
			{
				scenario: playgroundOrderUpdated,
				handler:
					({ get, set }) =>
					(data?: { order: IPlaygroundOrder }) => {
						const { id, updatedAt } = get();
						if (!data || data.order.id !== id || data.order.updatedAt === updatedAt)
							return;
						set({ serverChangedAt: data.order.updatedAt });
					},
			},
		],
	});
