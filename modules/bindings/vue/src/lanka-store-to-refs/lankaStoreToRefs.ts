import { computed } from "vue";
import type { ComputedRef } from "vue";
import type { TLankaStore } from "../define-lanka-store/defineLankaStore";

/** Every state member of a store, as a ref that keeps tracking. */
export type TLankaStoreRefs<TState extends object> = {
	[TKey in keyof TState]: ComputedRef<TState[TKey]>;
};

/**
 * Names you can destructure, without losing the reactivity.
 *
 * ```ts
 * const store = defineLankaStore(todosVM);
 * const { rows, isLoading } = lankaStoreToRefs(store);
 *
 * // in a template: {{ rows }} — in script: rows.value
 * ```
 *
 * `const { rows } = store` reads the value ONCE and stops tracking, and it is
 * the commonest mistake in a Pinia codebase for the good reason that it looks
 * exactly like code that works: the first paint is right and nothing updates
 * after it. Pinia's answer is `storeToRefs`, so this is that answer under a name
 * a reader recognises.
 *
 * Each ref is a `computed` over the same store, so nothing is copied and nothing
 * is subscribed a second time — the store's own subscription is still the only
 * one.
 *
 * Actions are left OUT, and that is not an oversight: an action is a stable
 * function for the life of the store, so `const { load } = store` is correct and
 * wrapping it in a ref would make every call site write `load.value()`.
 */
export const lankaStoreToRefs = <TState extends object>(
	store: TLankaStore<TState>,
): TLankaStoreRefs<TState> => {
	const refs = {} as TLankaStoreRefs<TState>;

	for (const key of Object.keys(store) as (keyof TState)[]) {
		if (typeof store[key] === "function") continue;

		refs[key] = computed(() => store[key]);
	}

	return refs;
};
