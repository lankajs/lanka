import { createLankaViewSubscription } from "lanka/extend";
import type { ILankaReadableVM } from "lanka/viewmodel";

/** What a subscriber is handed, and how it stops. */
export type TLankaStoreUnsubscriber = () => void;

/**
 * Svelte's store contract, which is an interface and not a class.
 *
 * One method. Anything with it works with `$store`, `derived`, `get` and every
 * helper in `svelte/store` — which is the whole reason the contract is that
 * small.
 */
export interface ILankaSvelteStore<TValue> {
	subscribe: (run: (value: TValue) => void) => TLankaStoreUnsubscriber;
}

/**
 * A ViewModel as a Svelte store, so `$` works on it.
 *
 * ```svelte
 * <script lang="ts">
 * 	import { toLankaSvelteStore } from "@lankajs/svelte";
 * 	const todos = toLankaSvelteStore(todosVM);
 * </script>
 *
 * {#each $todos.rows as row}<li>{row}</li>{/each}
 * ```
 *
 * ## Why this exists beside `useLankaVM`
 *
 * `useLankaVM` answers an object of getters, which is Svelte 5's own shape and
 * the right default: a read registers with the reactivity graph and with the
 * access tracker in ONE access, and nothing needs a `$`.
 *
 * The store contract is the other half of Svelte, and it has not gone anywhere.
 * `$page`, `$navigating` and every store SvelteKit hands a route are read with a
 * `$`; `derived`, `get` and `writable` all speak it; and a codebase that has not
 * moved to runes speaks nothing else. A consumer with that habit reaches for
 * `$todosVM`, and without this they are told a ViewModel is not a store.
 *
 * ## It is the same subscription
 *
 * One `subscribe` on the ViewModel per Svelte subscriber, the access tracker's
 * decision about whether a change is worth an update, and no state of its own —
 * the rules the parity canon sets for an idiom. What it does NOT do is share one
 * ViewModel subscription between Svelte subscribers: each gets its own tracker,
 * because two readers of one ViewModel read different keys and must be woken for
 * different changes. That is the same rule every binding on the shelf follows.
 *
 * ## The contract's own rule: call `run` immediately
 *
 * Svelte requires the current value on subscription, synchronously, before
 * `subscribe` returns — `$store` reads it during the component's first render
 * and would otherwise be `undefined`. `subscribe` on the ViewModel does NOT fire
 * on registration, which is correct for a port and is why the first call is made
 * here by hand.
 */
export const toLankaSvelteStore = <TState extends object>(
	viewModel: ILankaReadableVM<TState>,
): ILankaSvelteStore<TState> => ({
	subscribe: (run) => {
		const view = createLankaViewSubscription(viewModel, () => run(view.read()));

		// The contract's own rule: the current value, synchronously, before
		// `subscribe` returns. `$store` reads it during the first render and would
		// otherwise be `undefined` — and the ViewModel's `subscribe` deliberately
		// does not fire on registration, which is correct for a port.
		run(view.read());

		return view.stop;
	},
});
