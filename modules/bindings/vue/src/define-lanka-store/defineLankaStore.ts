import { getCurrentScope, onScopeDispose, shallowRef, triggerRef } from "vue";
import { createLankaViewSubscription } from "lanka/extend";
import type { ILankaReadableVM } from "lanka/viewmodel";

/**
 * A ViewModel read the way Vue reads a store.
 *
 * The state's own members, directly — `store.rows`, `store.load()` — plus the
 * one meta member a caller needs. `$`-prefixed, which is Pinia's convention for
 * exactly this reason: a store's keys belong to the application, and a meta
 * member sharing that namespace collides the day somebody adds a `stop` of their
 * own.
 */
export type TLankaStore<TState extends object> = TState & {
	/** Releases the subscription. Rarely needed: a component scope does it. */
	$stop: () => void;
};

/**
 * How the store answers for the ViewModel behind it.
 *
 * Its own function, because the traps are the whole mechanism and the factory
 * above is then the subscription and the Proxy. Read together they were sixty
 * lines whose shape said "a function doing two things", which is what the
 * composition canon calls it.
 */
const readsTheViewModel = <TState extends object, TStore extends object>(
	current: () => TState,
	stop: () => void,
): ProxyHandler<TStore> => ({
	get: (_target, key) => (key === "$stop" ? stop : Reflect.get(current(), key)),

	has: (_target, key) => key === "$stop" || key in current(),

	ownKeys: () => Reflect.ownKeys(current()),

	/*
	 * Reported as configurable, always.
	 *
	 * A Proxy must not claim a non-configurable descriptor its target lacks — the
	 * runtime throws. The target here is a bare object while the keys live on the
	 * state, so every descriptor this hands back is invented and must say it can be
	 * redefined. Without it `{ ...store }` and `Object.keys(store)` throw rather
	 * than read, and a devtool does one of them on sight.
	 */
	getOwnPropertyDescriptor: (_target, key) =>
		key === "$stop"
			? { value: stop, configurable: true, enumerable: false, writable: false }
			: { ...Reflect.getOwnPropertyDescriptor(current(), key), configurable: true },
});

/**
 * Declares a store, the way Pinia declares one.
 *
 * ```ts
 * // todosStore.ts — at module level, like `defineStore`
 * export const useTodosStore = defineLankaStore(todosVM);
 * ```
 *
 * ```vue
 * <script setup lang="ts">
 * const todos = useTodosStore();
 * </script>
 *
 * <template><li v-for="row in todos.rows" :key="row">{{ row }}</li></template>
 * ```
 *
 * ## Why it answers a FUNCTION and not the store
 *
 * Pinia's shape, and not only for the look of it. A store built at module level
 * would open its subscription at IMPORT time, outside any component scope — so
 * nothing would ever release it, and every component would share ONE recording.
 * Two components reading different keys would then wake each other, which is the
 * whole of what access tracking exists to prevent. Returning it as written, and
 * measured: the component reading only `rows` re-rendered when `unread` moved.
 *
 * So each CALL builds a store, inside the calling component's scope, with its own
 * subscription and its own recording — and Vue releases it when that component
 * goes.
 *
 * ## Where it differs from Pinia, and why
 *
 * `useTodosStore()` in two components answers two objects, where Pinia answers
 * one. The state behind them is the same ViewModel and there is no second store —
 * what differs is the RECORDING, which belongs to whoever did the reading. Making
 * the object shared would make tracking coarse, and an idiom is not allowed to
 * change behaviour: that is the rule the parity canon sets for all of them.
 *
 * Reading it outside a component is legal and gives an unscoped store; the caller
 * then owns `$stop`.
 */
export const defineLankaStore =
	<TState extends object>(viewModel: ILankaReadableVM<TState>) =>
	(): TLankaStore<TState> => {
		/*
		 * A counter, not the state.
		 *
		 * `triggerRef` as well as the increment for the reason every binding on this
		 * shelf carries: a tracked read hands back the SAME proxy while the state
		 * object is unchanged, and a shallow ref compares by identity.
		 */
		const version = shallowRef(0);

		const view = createLankaViewSubscription(viewModel, () => {
			version.value += 1;
			triggerRef(version);
		});

		// Inside a component or an `effectScope`, Vue owns the lifetime and the
		// subscription goes with it. Outside one there is nothing to attach to, and
		// `onScopeDispose` would warn — so the caller keeps `$stop`.
		if (getCurrentScope()) onScopeDispose(view.stop);

		const current = (): TState => {
			// Read for the DEPENDENCY, discard the number. A template reading
			// `store.rows` must re-render when the counter moves, and the counter is
			// the only reactive thing in here.
			void version.value;

			return view.read();
		};

		return new Proxy({} as TLankaStore<TState>, readsTheViewModel(current, view.stop));
	};
