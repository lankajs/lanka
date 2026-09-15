import type { IPlaygroundOrderEditActions } from "./IPlaygroundOrderEditActions";
import type { IPlaygroundOrderInput } from "./IPlaygroundOrderInput";

/**
 * What every form screen is handed, whichever library it is written with.
 *
 * Two things, and both come from the ViewModel: the values to start from —
 * the server's version — and the one action to call on submit. A form screen
 * that needed a third thing would be a form reaching past its ViewModel.
 */
export interface IPlaygroundFormScreenProps {
	initial: IPlaygroundOrderInput;
	submit: IPlaygroundOrderEditActions["submit"];
}
