import { createSignal, getOwner, onCleanup } from "solid-js";
import { createLankaAccessTracker } from "lanka/extend";
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
	const tracker = createLankaAccessTracker(viewModel);
	const [version, setVersion] = createSignal(0);

	const stop = viewModel.subscribe((next, prev) => {
		if (!tracker.shouldNotify(next, prev)) {
			// No update will follow. If the changed key is linked to this reader
			// through a getter it read, the screen froze — and in development core
			// says so by name.
			tracker.reportSkipped(next, prev);
			return;
		}

		setVersion((seen) => seen + 1);
	});

	// An owner is a component or a `createRoot`. Outside one there is nothing to
	// attach to and `onCleanup` would warn, so the caller keeps `$stop`.
	if (getOwner()) onCleanup(stop);

	const current = (): TState => {
		// Read for the DEPENDENCY, discard the number. A computation reading
		// `store.rows` must re-run when the version moves, and the version is the
		// only signal in here.
		void version();

		return tracker.read();
	};

	return new Proxy({} as TLankaSolidStore<TState>, {
		get: (_target, key) => (key === "$stop" ? stop : Reflect.get(current(), key)),

		has: (_target, key) => key === "$stop" || key in current(),

		ownKeys: () => Reflect.ownKeys(current()),

		/*
		 * Reported as configurable, always: a Proxy must not claim a
		 * non-configurable descriptor its target lacks, and the target here is a
		 * bare object while the keys live on the state. Without it `{ ...store }`
		 * and `Object.keys(store)` throw rather than read.
		 */
		getOwnPropertyDescriptor: (_target, key) =>
			key === "$stop"
				? { value: stop, configurable: true, enumerable: false, writable: false }
				: { ...Reflect.getOwnPropertyDescriptor(current(), key), configurable: true },
	});
};
