import type { ILankaFieldError } from "lanka/errors";

/**
 * A form held by the ViewModel itself — the configuration most screens need.
 *
 * Each input is a key of its OWN: access tracking compares the root keys of the
 * state, so a screen reading `customer` re-renders when `customer` moves and not
 * when `note` does. One `values` object would make every keystroke everybody's,
 * and proving that is the whole reason this shape is in a BINDING's playground.
 */
export interface IPlaygroundRenameState {
	customer: string;
	/** A second input, never sent: here to show one moving does not repaint the other. */
	note: string;
	fieldErrors: readonly ILankaFieldError[];
}
