import type { ILankaReadableVM } from "lanka/viewmodel";

/**
 * A ViewModel, rendered by hand — the whole of what a binding does, in a file
 * this application owns rather than installs.
 *
 * It is here to be READ. `modules/bindings/*` exists because five frameworks
 * each need this written their own way; an application with no framework needs
 * nobody's, and what is left is `subscribe`, `getState` and a function that
 * paints. There is no fifth thing.
 *
 * ## No access tracking, on purpose
 *
 * `createLankaAccessTracker` is published from `lanka/extend` and would work
 * here. It is left out because its job is to SKIP renders, and a render here is
 * one DOM call the browser is about to coalesce anyway. A framework needs it
 * because a re-render costs a component tree; this costs `replaceChildren`.
 *
 * That is worth saying out loud: the optimisation belongs to the binding layer,
 * not to the ViewModel, which is why it lives in `lanka/extend` rather than
 * inside `subscribe`.
 */
export const bindAtlasVM = <TState extends object>(
	viewModel: ILankaReadableVM<TState>,
	paint: (state: TState) => void,
): (() => void) => {
	paint(viewModel.getState());

	return viewModel.subscribe((next) => {
		paint(next);
	});
};
