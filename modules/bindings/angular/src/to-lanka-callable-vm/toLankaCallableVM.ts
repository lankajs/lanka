import { createLankaCallableVM } from "lanka/extend";
import { useLankaVM } from "../use-lanka-vm/useLankaVM";
import type { Signal } from "@angular/core";
import type { ILankaReadableVM } from "lanka/viewmodel";

/**
 * The two call shapes, named once.
 *
 * Written out twice — here and as `createLankaCallableVM`'s second type argument
 * — they could drift and nothing would say so: that argument is an ASSERTION
 * rather than a checked parameter, so a copy that stopped matching would leave
 * the published `TLankaAngularCallableVM` describing something the runtime does
 * not answer. One name, used at both sites, is what the other three members do.
 */
type TLankaAngularVMCall<TState extends object> = {
	(): Signal<TState>;
	<TSelected>(selector: (state: TState) => TSelected): Signal<TSelected>;
};

/**
 * The ViewModel it was given, plus Angular's read on the object itself.
 *
 * Both call shapes, because `useLankaVM` has both: no argument gives a signal
 * over the tracked state, a selector gives a signal over what the selector
 * picked. A `Signal` either way — that is the one thing this shelf cannot make
 * uniform, and the reason the six factory names answer something different in
 * every member.
 */
export type TLankaAngularCallableVM<TViewModel extends ILankaReadableVM<object>> = TViewModel &
	TLankaAngularVMCall<ReturnType<TViewModel["getState"]>>;

/**
 * Gives a ViewModel Angular's read, pre-applied — the one shape the six
 * factories in `_factories/` are built out of.
 *
 * ## Why this is `useLankaVM` and NOT `toLankaSignals`
 *
 * `toLankaSignals` calls `assertInInjectionContext` the moment it is CALLED, and
 * these factories call this at the DECLARATION — module level, at import time,
 * where no injection context exists. Pre-applying it would turn every
 * `export const useTodoVM = createLankaVM({ … })` into a throw on import.
 *
 * `useLankaVM` moves that same assertion to where it belongs: the callable
 * answers per CALL, inside the component's own injection context, which is
 * exactly where invariant 2 of this package requires it. `toLankaSignals` and
 * `toLankaObservable` keep their own published names and are untouched by this
 * — and both take the result of these factories, because the ViewModel's
 * members are forwarded onto it.
 *
 * ## Why it is not published as a value
 *
 * `@lankajs/react` publishes `toLankaReactVM` because a React consumer had a
 * callable ViewModel before the port existed and wants that spelling back for a
 * ViewModel this package did not declare. Angular never had one: the shelf's
 * portable spelling is `useLankaVM(todoVM)` and Angular's own is
 * `toLankaSignals(todoVM)`, both already published, so a third public seam would
 * be a name with nothing to do. What IS published is the TYPE, because it is
 * what the six factories answer and a consumer annotating one needs to say it.
 *
 * ## What it does NOT do
 *
 * It adds no state and no second store. The forwarding is
 * `createLankaCallableVM` in core — a Proxy rather than copied properties — so a
 * LAZY ViewModel still builds on first access: reading `useTodoVM.name` answers
 * from the config and constructs nothing.
 */
export const toLankaCallableVM = <TViewModel extends ILankaReadableVM<object>>(
	viewModel: TViewModel,
): TLankaAngularCallableVM<TViewModel> =>
	createLankaCallableVM<TViewModel, TLankaAngularVMCall<ReturnType<TViewModel["getState"]>>>(
		viewModel,
		/**
		 * The call signature, and the whole of it.
		 *
		 * ONE call, with the selector forwarded as it arrived rather than branched
		 * on: `useLankaVM` has an overload for exactly this, and a branch here would
		 * be two call sites claiming to be one. Whether a selector was passed is a
		 * property of the CALL SITE, which is what lets the subscription underneath
		 * stand still for the caller's whole life.
		 */
		(selector?: (state: object) => unknown): unknown => useLankaVM(viewModel, selector),
	);
