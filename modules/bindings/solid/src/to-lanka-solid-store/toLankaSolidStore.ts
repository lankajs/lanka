import { createSignal, getOwner, onCleanup } from "solid-js";
import { createLankaViewSubscription } from "lanka/extend";
import type { ILankaReadableVM } from "lanka/viewmodel";

/**
 * A ViewModel read the way Solid reads a store.
 *
 * The state's own members, directly, plus the one meta member a caller needs.
 * `$`-prefixed so it cannot collide with a state key, which is the same reason
 * Solid's own stores keep their helpers off the object.
 */
export type TLankaSolidStore<TState extends object> = TState & {
	/** Releases the subscription. Rarely needed: an owner does it. */
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
 * Reads a ViewModel as a Solid store, with no call on the outside.
 *
 * ```tsx
 * const todos = toLankaSolidStore(todosVM);
 *
 * <For each={todos.rows}>{(row) => <li>{row}</li>}</For>
 * ```
 *
 * ## Why this exists beside `useLankaVM`
 *
 * `useLankaVM` answers an `Accessor`, which is Solid's own shape for a value and
 * the one every other binding on the shelf parallels: `state().rows`. It is also
 * not how Solid holds an OBJECT. `createStore` gives a proxy read as `state.rows`
 * — no call, and the read itself is the subscription — and that is what a Solid
 * codebase has in it. A consumer with that habit writes `todos.rows`, gets
 * `undefined`, and learns that lanka is a foreign object.
 *
 * ## The read is the subscription, in both graphs at once
 *
 * A read goes through the access tracker, which records the key, AND through the
 * signal, which registers the surrounding computation with Solid. One access,
 * two graphs — the same alignment the Svelte binding gets from getters, and the
 * reason neither of them needs a diff.
 *
 * The signal holds a VERSION rather than the state. A tracked read hands back the
 * same proxy while the state object is unchanged, and Solid compares by identity,
 * so a signal holding the state would be a no-op exactly when the tracker did its
 * job — and a signal holding the state is also a SNAPSHOT, which is wrong for
 * something read from ordinary code at arbitrary moments. `store.load()` followed
 * by `store.rows` is the shape that settles it.
 *
 * ## What it is not
 *
 * Not `createStore`. Solid's store is a write path as well as a read one, and a
 * ViewModel's writes belong to its actions — `setStore` beside them would be a
 * second place state changes. This is the read half, which is the half a screen
 * has.
 */
export const toLankaSolidStore = <TState extends object>(
	viewModel: ILankaReadableVM<TState>,
): TLankaSolidStore<TState> => {
	const [version, setVersion] = createSignal(0);

	const view = createLankaViewSubscription(viewModel, () => {
		setVersion((seen) => seen + 1);
	});

	// An owner is a component or a `createRoot`. Outside one there is nothing to
	// attach to and `onCleanup` would warn, so the caller keeps `$stop`.
	if (getOwner()) onCleanup(view.stop);

	const current = (): TState => {
		// Read for the DEPENDENCY, discard the number. A computation reading
		// `store.rows` must re-run when the version moves, and the version is the
		// only signal in here.
		void version();

		return view.read();
	};

	return new Proxy({} as TLankaSolidStore<TState>, readsTheViewModel(current, view.stop));
};
