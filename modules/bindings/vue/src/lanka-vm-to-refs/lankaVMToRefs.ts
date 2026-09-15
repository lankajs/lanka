import { computed } from "vue";
import type { ComputedRef } from "vue";
import type { TLankaVueVM } from "../define-lanka-composable/defineLankaComposable";

/** Every state member of the ViewModel, as a ref that keeps tracking. */
export type TLankaVMRefs<TState extends object> = {
	[TKey in keyof TState]: ComputedRef<TState[TKey]>;
};

/**
 * Names you can destructure, without losing the reactivity.
 *
 * ```ts
 * const todos = useTodosVM();
 * const { rows, isLoading } = lankaVMToRefs(todos);
 *
 * // in a template: {{ rows }} — in script: rows.value
 * ```
 *
 * `const { rows } = todos` reads the value ONCE and stops tracking, and it is
 * the commonest mistake in a Pinia codebase for the good reason that it looks
 * exactly like code that works: the first paint is right and nothing updates
 * after it. Pinia's answer is `storeToRefs`, so this is that answer under a name
 * a reader recognises.
 *
 * Each ref is a `computed` over the same ViewModel, so nothing is copied and nothing
 * is subscribed a second time — the composable's own subscription is still the only
 * one.
 *
 * Actions are left OUT, and that is not an oversight: an action is a stable
 * function for the life of the store, so `const { load } = todos` is correct and
 * wrapping it in a ref would make every call site write `load.value()`.
 */
export const lankaVMToRefs = <TState extends object>(
	viewModel: TLankaVueVM<TState>,
): TLankaVMRefs<TState> => {
	const refs = {} as TLankaVMRefs<TState>;

	for (const key of Object.keys(viewModel) as (keyof TState)[]) {
		if (typeof viewModel[key] === "function") continue;

		refs[key] = computed(() => viewModel[key]);
	}

	return refs;
};
