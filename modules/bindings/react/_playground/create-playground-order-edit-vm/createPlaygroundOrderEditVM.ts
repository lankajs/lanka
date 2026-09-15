import { createLankaVM } from "lanka/viewmodel";
import { submitPlaygroundOrder } from "../submit-playground-order/submitPlaygroundOrder";
import type { IPlaygroundOrderEditActions } from "../_interfaces/IPlaygroundOrderEditActions";
import type { IPlaygroundOrderEditState } from "../_interfaces/IPlaygroundOrderEditState";
import type { IPlaygroundOrderServer } from "../_interfaces/IPlaygroundOrderServer";

/**
 * The ViewModel three form libraries drive, and the one place a save happens.
 *
 * `submit` answers `TPlaygroundSubmitOutcome` rather than throwing: a form does
 * not know what a transport is, so failures WITH an address come back as
 * `fields` and everything else is already in this ViewModel's state by the time
 * the form sees an empty failure. That contract is the subject of the scenes in
 * `playground.test.tsx`, and it is the same contract whichever library renders.
 */
export const createPlaygroundOrderEditVM = (server: IPlaygroundOrderServer = {}) => {
	let version = 1;

	return createLankaVM<IPlaygroundOrderEditState, IPlaygroundOrderEditActions>({
		name: "PlaygroundOrderEditVM",
		states: { server: null, screenError: null },
		createActions: ({ set }) => ({
			load: async (id) => {
				await Promise.resolve();
				set({
					server: {
						id,
						customer: "Ann",
						items: [
							{ sku: "a", qty: 1 },
							{ sku: "b", qty: 1 },
						],
						updatedAt: version,
					},
				});
			},

			submit: async (values) => {
				await Promise.resolve();
				const outcome = submitPlaygroundOrder(server, values, version + 1);

				if (outcome.ok) {
					version += 1;
					set({ server: outcome.data, screenError: null });
				}

				return outcome;
			},
		}),
	});
};
