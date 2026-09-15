import { createLankaVM } from "lanka/viewmodel";
import type { ILankaFieldError } from "lanka/errors";

/** A form's fields, one ROOT key each. */
export interface ILankaFakeFormState {
	customer: string;
	note: string;
	/** What the last submit refused, addressed by field. */
	fieldErrors: readonly ILankaFieldError[];
	[key: string]: unknown;
}

/** What the form can do. */
export interface ILankaFakeFormActions {
	setCustomer: (customer: string) => void;
	setNote: (note: string) => void;
	/** Refuses an empty customer, at that field's own address. */
	submit: () => Promise<void>;
}

/**
 * A form whose inputs live in the ViewModel, one key each.
 *
 * The shape that makes "re-render the input that changed and not its neighbour"
 * possible at all: access tracking compares ROOT keys, so `customer` and `note`
 * have to be two of them. A single `values` object would charge both readers for
 * every keystroke — and that is the sentence every binding's playground should be
 * able to prove, which is why this lives in the kit rather than in one of them.
 *
 * ## Why it is in the kit and not copied five times
 *
 * A member of a shelf may not depend on a sibling, so the kit is the one place
 * all five already look. Five copies of one ViewModel diverge — not on the day
 * they are written, but on the day one of them gains a key — and the playgrounds
 * would then be comparing different things while looking as though they were
 * not.
 *
 * ## Why the refusal is hand-written and not a schema
 *
 * A validator package would be a second subject: what a binding's playground
 * proves is that a field error reaches the input it belongs to, and where the
 * error came from is `modules/validators`' business. The shape is the one a
 * real validator answers — a path and a message — so a screen written against
 * this reads the same as a screen written against `lankaStandardValidator`.
 */
export const createLankaFakeFormVM = () =>
	createLankaVM<ILankaFakeFormState, ILankaFakeFormActions>({
		name: "LankaFakeFormVM",
		states: { customer: "Ann", note: "", fieldErrors: [] },
		createActions: ({ set, get }) => ({
			setCustomer: (customer) => {
				set({ customer });
			},
			setNote: (note) => {
				set({ note });
			},
			submit: async () => {
				// Awaited before the decision, so a screen has a moment where the
				// submit is in flight — which is what a binding's `act` has to cover.
				await Promise.resolve();

				set({
					fieldErrors:
						get().customer.trim() === ""
							? [{ path: ["customer"], message: "customer is required" }]
							: [],
				});
			},
		}),
	});
