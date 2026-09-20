import { createLankaCallableVM } from "lanka/extend";
import { useLankaVM } from "../../use-lanka-vm/useLankaVM";
import type { ILankaReadableVM } from "lanka/viewmodel";
import type { TLankaVMSelectedView, TLankaVMView } from "../../use-lanka-vm/useLankaVM";

/**
 * The two call shapes, and they answer DIFFERENT things.
 *
 * `useLankaVM` is what the call forwards to, so the callable inherits its two
 * arms exactly: no argument gives the object of getters, a selector gives one
 * value under `current`. React's callable can describe both arms with one type
 * parameter because both answer a plain value; Svelte's cannot, and flattening
 * them would hand a consumer `current` where there are getters or getters where
 * there is a number.
 */
type TLankaSvelteVMCall<TState extends object> = {
	(): TLankaVMView<TState>;
	<TSelected>(selector: (state: TState) => TSelected): TLankaVMSelectedView<TSelected>;
};

/** The ViewModel it was given, plus the ability to be read by calling it. */
export type TLankaSvelteCallableVM<TViewModel extends ILankaReadableVM<object>> = TViewModel &
	TLankaSvelteVMCall<ReturnType<TViewModel["getState"]>>;

/**
 * A ViewModel with Svelte's read already on it — the one piece the six factories
 * in `_factories/` share.
 *
 * Not published, and that is the point. `@lankajs/react` publishes
 * `toLankaReactVM` because a ViewModel WAS a React hook until 2.0 and a React
 * codebase migrates by wrapping what it already declared; Svelte never had that
 * spelling, so the wrapper has no consumer of its own and would be a name the
 * shelf has to keep for nothing. What Svelte publishes beside `useLankaVM` is
 * `toLankaSvelteVM`, which is a different thing entirely: the store contract, so
 * `$todoVM` works.
 *
 * The forwarding itself is `createLankaCallableVM` in core — a Proxy rather than
 * copied properties — so a LAZY ViewModel still builds on first access: reading
 * `todoVM.name` answers from the config and constructs nothing. It is core's
 * because all five bindings need it, and which members belong to the function
 * and what `in` must answer have one answer.
 *
 * It adds no state and no second store. A ViewModel read through this and the
 * same ViewModel read through `useLankaVM(vm)` are the same object, notify
 * identically and dispose identically.
 */
export const toLankaCallableVM = <TViewModel extends ILankaReadableVM<object>>(
	viewModel: TViewModel,
): TLankaSvelteCallableVM<TViewModel> =>
	createLankaCallableVM<TViewModel, TLankaSvelteVMCall<ReturnType<TViewModel["getState"]>>>(
		viewModel,
		/**
		 * The call signature, and the whole of it.
		 *
		 * ONE call, with the selector forwarded as it arrived: there is a
		 * `useLankaVM` overload for exactly this. A branch would be two call sites
		 * where the consumer wrote one, and `createSubscriber` opens its
		 * subscription from whichever read happens inside an effect — so a binding
		 * that reached the reader twice would be answering with two views over one
		 * ViewModel and releasing only one of them with `stop()`.
		 */
		(selector?: (state: object) => unknown): unknown => useLankaVM(viewModel, selector),
	);
