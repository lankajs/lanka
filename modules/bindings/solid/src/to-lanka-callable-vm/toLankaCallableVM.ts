import { createLankaCallableVM } from "lanka/extend";
import { useLankaVM } from "../use-lanka-vm/useLankaVM";
import type { TLankaVMAccessor } from "../use-lanka-vm/useLankaVM";
import type { ILankaReadableVM } from "lanka/viewmodel";

/**
 * What a call adds to the ViewModel, and both shapes of it.
 *
 * Both, because `useLankaVM` has both: no argument gives the tracked read, a
 * selector gives what the selector picked and bypasses tracking. Either way the
 * answer is a `TLankaVMAccessor` — `state()`, with a `stop` on it — because an
 * accessor is Solid's own idea of a value and the one thing this shelf
 * deliberately does not hide.
 *
 * Module-private, as Vue's is. The call shape is not something a Solid consumer
 * annotates against; the one name worth publishing is the whole answer below.
 */
type TLankaSolidCall<TState extends object> = {
	(): TLankaVMAccessor<TState>;
	<TSelected>(selector: (state: TState) => TSelected): TLankaVMAccessor<TSelected>;
};

/**
 * The ViewModel it was given, plus Solid's read of it.
 *
 * This is what the six factories in `_factories/` answer, and the only name out
 * of this file the barrel publishes: a consumer writes it wherever such a
 * declaration has to be annotated or passed on, and cannot write it if it has no
 * name.
 */
export type TLankaSolidCallableVM<TViewModel extends ILankaReadableVM<object>> = TViewModel &
	TLankaSolidCall<ReturnType<TViewModel["getState"]>>;

/**
 * Gives a ViewModel Solid's read, pre-applied.
 *
 * ```ts
 * const useTodoVM = toLankaCallableVM(todoVM);
 * ```
 *
 * ```tsx
 * const TodoScreen = () => {
 * 	const state = useTodoVM();
 * 	const count = useTodoVM((todos) => todos.rows.length);
 *
 * 	return <p>{count()} of {state().rows.length}</p>;
 * };
 * ```
 *
 * ## Why the pre-applied read is `useLankaVM` and not `toLankaSolidVM`
 *
 * Because a factory answers at the DECLARATION and a read must happen at the
 * CALL. `toLankaSolidVM` calls `createSignal` and `onCleanup`, so it must run
 * inside an owner; applying it where a ViewModel is declared — module level, at
 * import time — would open ONE subscription with no owner and hand every
 * component on the screen the same one. That is the defect `defineLankaComposable`
 * in the Vue binding documents, and it is the reason nothing here is applied
 * eagerly: what this wraps is the call, and the call runs inside the component.
 *
 * `toLankaSolidVM` is untouched by any of this. It keeps its own published name,
 * it is still called inside an owner, and it accepts what these factories answer
 * because the ViewModel's own members are forwarded onto the result.
 *
 * ## Why it is not published
 *
 * `@lankajs/react` publishes its equivalent, because a React codebase holds
 * ViewModels that WERE hooks before the port existed and wraps them one at a
 * time. Solid never had that spelling, so the only callers here are the six
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
): TLankaSolidCallableVM<TViewModel> =>
	createLankaCallableVM<TViewModel, TLankaSolidCall<ReturnType<TViewModel["getState"]>>>(
		viewModel,
		/**
		 * The call signature, and the whole of it.
		 *
		 * ONE call, with the selector forwarded as it arrived rather than branched
		 * on: `useLankaVM` has an overload for exactly this. Solid has no rule of
		 * hooks to break, so a branch would read the same — and it would still be
		 * two call sites of a function that opens a subscription and registers an
		 * `onCleanup`, which is the shape this shelf refuses everywhere else.
		 */
		(selector?: (state: object) => unknown): unknown => useLankaVM(viewModel, selector),
	);
