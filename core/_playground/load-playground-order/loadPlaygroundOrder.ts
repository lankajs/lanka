import { notePlaygroundServerOrder } from "../note-playground-server-order/notePlaygroundServerOrder";
import type { IPlaygroundOrder } from "../_interfaces/IPlaygroundOrder";
import type { IPlaygroundSubscription } from "../_interfaces/IPlaygroundSubscription";
import type { TPlaygroundOrderEditContext } from "../_types/TPlaygroundOrderEditContext";

/**
 * The first read of an order, and the start of listening for later ones.
 *
 * Listening starts BEFORE reading, so a change that lands between the two is not
 * missed; the read's own answer is ignored by the listener because nothing is
 * loaded yet when it arrives.
 *
 * With a cache underneath, the read goes through it — fresh is answered from
 * memory, and a second screen asking for the same order joins the request in
 * flight. Without one, the gateway is called directly. Nothing else differs.
 */
export const loadPlaygroundOrder = async (
	context: TPlaygroundOrderEditContext,
	held: IPlaygroundSubscription,
	id: number,
): Promise<void> => {
	const { gateways, services, set } = context;

	held.release?.();
	held.release =
		services.cache?.subscribe(["order", id], (data) => {
			notePlaygroundServerOrder(context, data as IPlaygroundOrder);
		}) ?? null;

	const order = services.cache
		? await services.cache.read(
				["order", id],
				(signal) => gateways.orderGateway.byId(id, { signal }),
				{ staleMs: 30_000 },
			)
		: await gateways.orderGateway.byId(id);

	set({ server: order, serverChangedAt: null, screenError: null });
};
