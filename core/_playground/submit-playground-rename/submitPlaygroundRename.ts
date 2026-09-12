import { lankaStandardValidator } from "../../src/validation/index";
import { playgroundOrderInputSchema } from "../playground-order-input-schema/playgroundOrderInputSchema";
import { playgroundOrderUpdated } from "../playground-order-updated/PlaygroundOrderUpdated";
import { sortPlaygroundFailure } from "../sort-playground-failure/sortPlaygroundFailure";
import type { TPlaygroundRenameContext } from "../_types/TPlaygroundRenameContext";

/**
 * The save, when the ViewModel holds the inputs itself.
 *
 * The inputs are checked with the same schema the gateway checks the payload
 * with, and the addressed failures land in `fieldErrors` — the same value a
 * form would be handed in the other configuration. Nothing else differs between
 * the two: the gateway, the schema, the announcement and the sorting of a
 * failure are the same code.
 */
export const submitPlaygroundRename = async ({
	get,
	set,
	gateways,
	trigger,
}: TPlaygroundRenameContext): Promise<void> => {
	const { id, customer, items, updatedAt } = get();
	if (id === null) return;

	const checked = lankaStandardValidator.validateSafe(playgroundOrderInputSchema, {
		customer,
		items,
	});
	if (!checked.success) {
		set({ fieldErrors: checked.fields ?? [] });
		return;
	}

	set({ isSubmitting: true, screenError: null, fieldErrors: [] });
	try {
		const order = await gateways.orderGateway.update(id, checked.data, {
			expectedUpdatedAt: updatedAt ?? undefined,
		});
		// Own write first, then the announcement: the handler below hears this
		// version and stays quiet.
		set({ customer: order.customer, updatedAt: order.updatedAt, serverChangedAt: null });
		trigger(playgroundOrderUpdated, { order });
	} catch (error) {
		const failure = sortPlaygroundFailure(error, (message) => set({ screenError: message }));
		set({ fieldErrors: failure.fields, screenError: failure.message ?? get().screenError });
	} finally {
		set({ isSubmitting: false });
	}
};
