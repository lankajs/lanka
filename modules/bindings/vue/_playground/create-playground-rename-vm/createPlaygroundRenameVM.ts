import { createLankaVM } from "lanka/viewmodel";
import type { IPlaygroundRenameActions } from "../_interfaces/IPlaygroundRenameActions";
import type { IPlaygroundRenameState } from "../_interfaces/IPlaygroundRenameState";

/**
 * A form whose inputs live in the ViewModel, one key each.
 *
 * The shape that makes "re-render the input that changed and not its neighbour"
 * possible at all: access tracking compares ROOT keys, so `customer` and `note`
 * have to be two of them. A single `values` object would charge both readers for
 * every keystroke, and the scene that proves the difference needs a renderer.
 *
 * The refusal is written by hand rather than taken from a schema: what this
 * playground is about is the BINDING, and `@lankajs/react`'s playground already
 * drives the same ViewModel through a Standard Schema and three form libraries.
 * A second copy of that would be a second subject.
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
				const isBlank = get().customer.trim().length === 0;

				set({
					fieldErrors: isBlank
						? [{ path: ["customer"], message: "a customer is required" }]
						: [],
				});
			},
		}),
	});
