import { createLankaVM } from "lanka/viewmodel";
import { lankaStandardValidator } from "lanka/validation";
import { playgroundOrderInputSchema } from "../playground-order-input-schema/playgroundOrderInputSchema";
import type { IPlaygroundRenameActions } from "../_interfaces/IPlaygroundRenameActions";
import type { IPlaygroundRenameState } from "../_interfaces/IPlaygroundRenameState";

/**
 * A form whose inputs live in the ViewModel, one key each.
 *
 * The shape that makes "re-render the input that changed and not its neighbour"
 * possible at all: access tracking compares ROOT keys, so `customer` and `note`
 * have to be two of them. A single `values` object would charge both readers for
 * every keystroke, and the scene that proves the difference needs a renderer —
 * which is why this VM is here and not in core's playground.
 */
export const createPlaygroundRenameVM = () =>
	createLankaVM<IPlaygroundRenameState, IPlaygroundRenameActions>({
		name: "PlaygroundRenameVM",
		states: { customer: "Ann", note: "", fieldErrors: [] },
		createActions: ({ set, get }) => ({
			setCustomer: (customer) => {
				set({ customer });
			},
			setNote: (note) => {
				set({ note });
			},
			submit: async () => {
				await Promise.resolve();
				const checked = lankaStandardValidator.validateSafe(playgroundOrderInputSchema, {
					customer: get().customer,
					items: [],
				});

				set({ fieldErrors: checked.success ? [] : (checked.fields ?? []) });
			},
		}),
	});
