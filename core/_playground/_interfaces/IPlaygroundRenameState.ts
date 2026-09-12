import type { ILankaFieldError } from "../../src/errors/index";
import type { IPlaygroundOrderItem } from "./IPlaygroundOrder";

/**
 * A form held by the ViewModel itself — the configuration most screens need.
 *
 * Each input is a key of its OWN: access tracking compares the root keys of the
 * state, so a screen reading `customer` re-renders when `customer` moves and not
 * when `note` does. One `values` object would make every keystroke everybody's.
 * That is also the boundary of this configuration — a list of lines would have
 * to nest, and nesting is where a form library takes over.
 */
export interface IPlaygroundRenameState {
	id: number | null;
	/** The input being edited. */
	customer: string;
	/** A second input, never sent: here to show one moving does not repaint the other. */
	note: string;
	items: IPlaygroundOrderItem[];
	/** The server's version the screen last saw. */
	updatedAt: number | null;
	/** A newer version arrived while editing; nothing was overwritten. */
	serverChangedAt: number | null;
	/** Failures with an input to be shown at. */
	fieldErrors: readonly ILankaFieldError[];
	/** Failures with nowhere to be shown but the screen. */
	screenError: string | null;
	isSubmitting: boolean;
}
