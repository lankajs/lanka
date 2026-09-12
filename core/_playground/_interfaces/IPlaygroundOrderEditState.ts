import type { IPlaygroundOrder } from "./IPlaygroundOrder";

/**
 * What the edit screen reads when a FORM holds the inputs.
 *
 * No input is here. What is: the version of the order the server holds, a
 * marker that a newer one arrived while editing, and the two things a form has
 * no place for — the screen's failure and whether a save is in flight when that
 * matters beyond the form itself.
 */
export interface IPlaygroundOrderEditState {
	/** The server's version as this screen last saw it — the form's defaults. */
	server: IPlaygroundOrder | null;
	/** The version that arrived from elsewhere while editing; `null` while none has. */
	serverChangedAt: number | null;
	screenError: string | null;
	isSubmitting: boolean;
}
