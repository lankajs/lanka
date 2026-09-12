import { playgroundOrderUpdated } from "../playground-order-updated/PlaygroundOrderUpdated";
import { sortPlaygroundFailure } from "../sort-playground-failure/sortPlaygroundFailure";
import type { IPlaygroundOrder } from "../_interfaces/IPlaygroundOrder";
import type { IPlaygroundOrderInput } from "../_interfaces/IPlaygroundOrderInput";
import type { TPlaygroundOrderEditContext } from "../_types/TPlaygroundOrderEditContext";
import type { TPlaygroundSubmitOutcome } from "../_types/TPlaygroundSubmitOutcome";

/**
 * The save, when a form holds the inputs and hands them over.
 *
 * The success path is in a fixed ORDER, and the order is the rule:
 *
 * 1. `server` is written — the own write is marked, so the two listeners below
 *    hear this version and stay quiet;
 * 2. the fact is announced, with the data, so subscribers apply it rather than
 *    ask the server again;
 * 3. the cache hears, when there is one: the detail is written, the list is
 *    made stale;
 * 4. the form hears last, through the return value — it is still mounted here.
 *    Navigating is the screen's job, after this returns.
 *
 * On failure the form is answered with what has an address and the screen is
 * told the rest; the form never sees a `LankaError`.
 */
export const submitPlaygroundOrder = async (
	{ get, set, gateways, services, trigger }: TPlaygroundOrderEditContext,
	values: IPlaygroundOrderInput,
	options: { signal?: AbortSignal } = {},
): Promise<TPlaygroundSubmitOutcome<IPlaygroundOrder>> => {
	const server = get().server;
	if (!server) return { ok: false, fields: [], message: "nothing is loaded" };

	set({ isSubmitting: true, screenError: null });
	try {
		const order = await gateways.orderGateway.update(server.id, values, {
			expectedUpdatedAt: server.updatedAt,
			signal: options.signal,
		});

		set({ server: order, serverChangedAt: null });
		trigger(playgroundOrderUpdated, { order });
		services.cache?.write(["order", order.id], order);
		void services.cache?.invalidate(["orders"]);

		return { ok: true, data: order };
	} catch (error) {
		return sortPlaygroundFailure(error, (message) => set({ screenError: message }));
	} finally {
		set({ isSubmitting: false });
	}
};
