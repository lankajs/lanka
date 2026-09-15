import { getCurrentScope, onScopeDispose, shallowRef, triggerRef } from "vue";
import { createLankaViewSubscription } from "lanka/extend";
import type { ILankaReadableVM } from "lanka/viewmodel";

/**
 * A ViewModel as Vue reads one: its own members, directly.
 *
 * `vm.rows`, `vm.load()` — no `.value`, in the script and in the template alike
 * — plus the one meta member a caller needs. `$`-prefixed, which is Pinia's
 * convention and its reason: the keys belong to the application, and a meta
 * member sharing that namespace collides the day somebody adds a `stop` of their
 * own.
 *
 * Called a ViewModel and not a store, deliberately. Pinia's word for the thing a
 * component reads is "store", and this reads the way one does — but what holds
 * the state, the actions and the scenario bindings is the ViewModel, and naming
 * it after the shape it wears would hide where the work lives.
 */
export type TLankaVueVM<TState extends object> = TState & {
	/** Releases the subscription. Rarely needed: a component scope does it. */
	$stop: () => void;
};

/**
 * How the composable answers for the ViewModel behind it.
 *
 * Its own function, because the traps are the whole mechanism and the factory
 * below is then the subscription and the Proxy.
 */
const readsTheViewModel = <TState extends object, TFacade extends object>(
	current: () => TState,
	stop: () => void,
): ProxyHandler<TFacade> => ({
	get: (_target, key) => (key === "$stop" ? stop : Reflect.get(current(), key)),

	has: (_target, key) => key === "$stop" || key in current(),

	ownKeys: () => Reflect.ownKeys(current()),

	/*
	 * Reported as configurable, always.
	 *
	 * A Proxy must not claim a non-configurable descriptor its target lacks — the
	 * runtime throws. The target here is a bare object while the keys live on the
	 * state, so every descriptor this hands back is invented and must say it can
	 * be redefined. Without it `{ ...vm }` and `Object.keys(vm)` throw rather than
	 * read, and a Vue devtool does one of them on sight.
	 */
	getOwnPropertyDescriptor: (_target, key) =>
		key === "$stop"
			? { value: stop, configurable: true, enumerable: false, writable: false }
			: { ...Reflect.getOwnPropertyDescriptor(current(), key), configurable: true },
});

/**
 * Declares the composable a Vue component reads a ViewModel through.
 *
 * ```ts
 * // todosVM.ts — at module level, the way `defineStore` is declared
 * export const useTodosVM = defineLankaComposable(todosVM);
 * ```
 *
 * ```vue
 * <script setup lang="ts">
 * const todos = useTodosVM();
 * </script>
 *
 * <template><li v-for="row in todos.rows" :key="row">{{ row }}</li></template>
 * ```
 *
 * ## Why this exists beside `useLankaVM`
 *
 * `useLankaVM` answers a `ShallowRef`, which is the honest shape for Vue's
 * reactivity and the one every other binding on the shelf parallels. It is also
 * not what a Pinia codebase reads: there a component reads members straight off
 * what it was handed, in the template and the script alike, and `.value` appears
 * in neither. A consumer with that habit types `todos.rows`, gets `undefined`,
 * and learns that lanka is a foreign object.
 *
 * ## Why it answers a FUNCTION and not the reader itself
 *
 * Pinia's shape, and not only for the look of it. A reader built at module level
 * would open its subscription at IMPORT time, outside any component scope — so
 * nothing would ever release it, and every component would share ONE recording.
 * Two components reading different keys would then wake each other, which is the
 * whole of what access tracking exists to prevent. Measured before this shape
 * existed: the component reading only `rows` re-rendered when `unread` moved.
 *
 * So each CALL builds a reader, inside the calling component's scope, with its
 * own subscription and its own recording — and Vue releases it when that
 * component goes.
 *
 * ## Where it differs from Pinia, and why
 *
 * `useTodosVM()` in two components answers two objects, where Pinia answers one.
 * The ViewModel behind them is the same one and there is no second copy of the
 * state — what differs is the RECORDING, which belongs to whoever did the
 * reading. Sharing the object would make tracking coarse, and an idiom is not
 * allowed to change behaviour: that is the rule the parity canon sets for all of
 * them.
 *
 * Calling it outside a component is legal and gives an unscoped reader; the
 * caller then owns `$stop`.
 *
 * ## Reading is tracking
 *
 * Reads go through the access tracker, so a template reading only `rows` is not
 * woken by `isLoading`, and a ViewModel that turned tracking off is heard for
 * everything. Both are core's answers; nothing here decides either. The ref
 * holds a version counter rather than the state, because a ref holding the state
 * is a SNAPSHOT — right for a template, which re-reads when the ref changes, and
 * wrong for something also read from ordinary code at arbitrary moments.
 *
 * ## Destructuring loses reactivity, exactly as it does in Pinia
 *
 * `const { rows } = todos` copies a value out and stops tracking, which is the
 * single most common mistake in a Pinia codebase. `lankaVMToRefs(todos)` is the
 * same answer Pinia gives, under a name that says what it is reading.
 */
export const defineLankaComposable =
	<TState extends object>(viewModel: ILankaReadableVM<TState>) =>
	(): TLankaVueVM<TState> => {
		/*
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
			// `todos.rows` must re-render when the counter moves, and the counter is
			// the only reactive thing in here.
			void version.value;

			return view.read();
		};

		return new Proxy({} as TLankaVueVM<TState>, readsTheViewModel(current, view.stop));
	};
