import { createLankaVM } from "../../src/viewmodel/index";
import { loadPlaygroundOrder } from "../load-playground-order/loadPlaygroundOrder";
import { notePlaygroundServerOrder } from "../note-playground-server-order/notePlaygroundServerOrder";
import { playgroundOrderUpdated } from "../playground-order-updated/PlaygroundOrderUpdated";
import { submitPlaygroundOrder } from "../submit-playground-order/submitPlaygroundOrder";
import type { PlaygroundOrderGateway } from "../playground-order-gateway/PlaygroundOrderGateway";
import type { IPlaygroundOrder } from "../_interfaces/IPlaygroundOrder";
import type { IPlaygroundOrderEditActions } from "../_interfaces/IPlaygroundOrderEditActions";
import type { IPlaygroundOrderEditState } from "../_interfaces/IPlaygroundOrderEditState";
import type { IPlaygroundOrderGateways } from "../_interfaces/IPlaygroundOrderGateways";
import type { IPlaygroundOrderServices } from "../_interfaces/IPlaygroundOrderServices";
import type { IPlaygroundReadCache } from "../_interfaces/IPlaygroundReadCache";
import type { IPlaygroundSubscription } from "../_interfaces/IPlaygroundSubscription";

/**
 * Configurations two and four: a form holds the inputs; a cache may sit below.
 *
 * The ViewModel keeps nothing a form owns — no value, no touched flag, no
 * per-input message. It keeps what a form has no place for: the server's
 * version, the marker that a newer one arrived, the screen's failure, and the
 * orchestration of a save. With a cache underneath it reads through it and
 * listens to it; without one it reads the gateway and listens to scenarios
 * alone. Nothing else changes, which is the point of making it one ViewModel.
 *
 * The form and the cache never meet. Both talk to this, and this decides.
 */
export const createPlaygroundOrderEditVM = (
	orderGateway: PlaygroundOrderGateway,
	cache: IPlaygroundReadCache | null = null,
) => {
	const held: IPlaygroundSubscription = { release: null };

	return createLankaVM<
		IPlaygroundOrderEditState,
		IPlaygroundOrderEditActions,
		IPlaygroundOrderGateways,
		IPlaygroundOrderServices
	>({
		name: cache ? "PlaygroundCachedOrderEditVM" : "PlaygroundOrderEditVM",
		gateways: () => ({ orderGateway }),
		services: () => ({ cache }),
		states: { server: null, serverChangedAt: null, screenError: null, isSubmitting: false },

		createActions: (context) => ({
			load: (id) => loadPlaygroundOrder(context, held, id),

			submit: (values, options) => submitPlaygroundOrder(context, values, options),

			checkCustomer: async (name) =>
				(await context.gateways.orderGateway.isCustomerKnown(name))
					? null
					: "unknown customer",
		}),

		scenarioHandlers: [
			{
				scenario: playgroundOrderUpdated,
				handler: (context) => (data?: { order: IPlaygroundOrder }) => {
					if (data) notePlaygroundServerOrder(context, data.order);
				},
			},
		],

		onReset: () => {
			held.release?.();
			held.release = null;
		},
	});
};
