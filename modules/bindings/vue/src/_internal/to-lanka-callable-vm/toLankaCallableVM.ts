import { createLankaCallableVM } from "lanka/extend";
import { useLankaVM } from "../../use-lanka-vm/useLankaVM";
import type { ILankaVMRef } from "../../use-lanka-vm/useLankaVM";
import type { ILankaReadableVM } from "lanka/viewmodel";

/**
 * What a call adds to the ViewModel, and both shapes of it.
 *
 * Both, because `useLankaVM` has both: no argument gives the tracked read, a
 * selector gives what the selector picked and bypasses tracking. Either way the
 * answer is a `ShallowRef` — a template unwraps it, a script does not — because
 * that is Vue's own idea of reactivity and the one thing this shelf deliberately
 * does not hide.
 *
 * Module-private, unlike React's equivalent. There the call shape is the
 * migration target a consumer annotates against; here nothing is migrating, so
 * the one name worth publishing is the whole answer below.
 */
type TLankaVueCall<TState extends object> = {
	(): ILankaVMRef<TState>;
	<TSelected>(selector: (state: TState) => TSelected): ILankaVMRef<TSelected>;
};

/**
 * The ViewModel it was given, plus Vue's read of it.
 *
 * This is what the six factories in `_factories/` answer, and the only name out
 * of this file the barrel publishes: a consumer writes it wherever such a
 * declaration has to be annotated or passed on, and cannot write it if it has no
 * name.
 */
export type TLankaVueCallableVM<TViewModel extends ILankaReadableVM<object>> = TViewModel &
	TLankaVueCall<ReturnType<TViewModel["getState"]>>;

/**
 * Gives a ViewModel Vue's read, pre-applied.
 *
 * ```ts
 * const useTodoVM = toLankaCallableVM(todoVM);
 * ```
 *
 * ```vue
 * <script setup lang="ts">
 * const state = useTodoVM();
 * const count = useTodoVM((todos) => todos.rows.length);
 * </script>
 * ```
 *
 * ## Why it is not published
 *
 * `@lankajs/react` publishes its equivalent, because a React codebase holds
 * ViewModels that WERE hooks before the port existed and wraps them one at a
 * time. Vue never had that spelling, so the only callers here are the six
 * factories beside it — and a name with one caller and no history is machinery,
 * which `skills/structure/SKILL.md` 5a-ii files under `_internal/`. What a
 * consumer needs out of this file is the TYPE, and that is exported.
 *
 * ## What it does NOT do
 *
 * It adds no state and no second store. The forwarding is
 * `createLankaCallableVM` in core — a Proxy rather than copied properties — so a
 * LAZY ViewModel still builds on first access: reading `useTodoVM.name` answers
 * from the config and constructs nothing. Which members belong to the function,
 * and what `in` must answer, have one answer for all five bindings and it is
 * core's.
 */
export const toLankaCallableVM = <TViewModel extends ILankaReadableVM<object>>(
	viewModel: TViewModel,
): TLankaVueCallableVM<TViewModel> =>
	createLankaCallableVM<TViewModel, TLankaVueCall<ReturnType<TViewModel["getState"]>>>(
		viewModel,
		/**
		 * The call signature, and the whole of it.
		 *
		 * ONE call, with the selector forwarded as it arrived rather than branched
		 * on: `useLankaVM` has an overload for exactly this. A branch would read the
		 * same here — Vue has no rule of hooks to break — and it would still be two
		 * call sites of a composable that opens a subscription and registers an
		 * `onScopeDispose`, which is the shape this shelf refuses everywhere else.
		 */
		(selector?: (state: object) => unknown): unknown => useLankaVM(viewModel, selector),
	);
