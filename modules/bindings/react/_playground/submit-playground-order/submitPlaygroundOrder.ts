import type { IPlaygroundOrder } from "../_interfaces/IPlaygroundOrder";
import type { IPlaygroundOrderInput } from "../_interfaces/IPlaygroundOrderInput";
import type { IPlaygroundOrderServer } from "../_interfaces/IPlaygroundOrderServer";
import type { TPlaygroundSubmitOutcome } from "../_types/TPlaygroundSubmitOutcome";

/**
 * What the fake server does with a save, sorted into what a form can use.
 *
 * Its own function because it is the only thing in this playground with a
 * DECISION in it: a refusal with an address, a refusal without one, or a new
 * version. The ViewModel around it just writes the answer down.
 */
export const submitPlaygroundOrder = (
	server: IPlaygroundOrderServer,
	values: IPlaygroundOrderInput,
	nextVersion: number,
): TPlaygroundSubmitOutcome<IPlaygroundOrder> => {
	if (server.refuseWith) return { ok: false, fields: [], message: server.refuseWith };

	const refusals = Object.entries(server.refusals ?? {}).map(([index, message]) => ({
		path: ["items", Number(index), "qty"] as (string | number)[],
		message,
	}));

	// A refused save is not a version: nothing the ViewModel holds moves.
	if (refusals.length > 0) return { ok: false, fields: refusals };

	return {
		ok: true,
		data: {
			id: 1,
			customer: values.customer,
			items: values.items,
			updatedAt: nextVersion,
		},
	};
};
