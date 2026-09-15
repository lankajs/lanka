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
 * Reads a ViewModel as an ordinary reactive object, with no `.value` anywhere.
 *
 * ```ts
 * const todos = defineLankaStore(todosVM);
 *
 * // in a template: {{ todos.rows }} — in script: todos.rows, todos.load()
 * ```
 *
 * ## Why this exists beside `useLankaVM`
 *
 * `useLankaVM` answers a `ShallowRef`, which is the honest shape for Vue's
 * reactivity and the one every other binding on the shelf parallels. It is also
 * not what a Vue codebase reads: Pinia hands back a store whose members are read
 * straight off it, in the template and in the script alike, and `.value` appears
 * in neither. A consumer arriving with that habit types `store.rows`, gets
 * `undefined`, and learns that lanka is a foreign object.
 *
 * ## One subscription, and the reads are LIVE
 *
 * The ref here holds a version counter rather than the state, and that is the
 * whole difference from wrapping `useLankaVM`. A ref holding the state is a
 * SNAPSHOT — correct for a template, which re-reads when the ref changes, and
 * wrong for a store, which is also read from ordinary code at arbitrary moments.
 * `store.load()` followed by `store.rows` is the shape that found it: the second
 * line read a value captured before the first.
 *
 * So every read goes to `tracker.read()`, which asks the ViewModel for its
 * current state each time, and the counter exists only to tell Vue that
 * something moved. One subscription, one store, the same notifications
 * `useLankaVM` would have produced — which is what the parity canon asks of an
 * idiom.
 *
 * ## Reading is tracking
 *
 * Reads go through the access tracker, so a template reading only `rows` is not
 * woken by `isLoading`, and a ViewModel that turned tracking off is heard for
 * everything. Both are core's answers; nothing here decides either.
 *
 * ## Destructuring loses reactivity, exactly as it does in Pinia
 *
 * `const { rows } = store` copies a value out and stops tracking, which is the
 * single most common mistake in a Pinia codebase. `lankaStoreToRefs(store)` is
 * the same answer Pinia gives, under a name that says so.
 */
export const defineLankaStore = <TState extends object>(
	viewModel: ILankaReadableVM<TState>,
): TLankaStore<TState> => {
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
		// `store.rows` must re-render when the counter moves, and the counter is the
		// only reactive thing in here.
		void version.value;

		return view.read();
	};

	return new Proxy({} as TLankaStore<TState>, readsTheViewModel(current, view.stop));
};
