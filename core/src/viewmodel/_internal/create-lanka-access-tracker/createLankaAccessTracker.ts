import { lankaBlindSpotRegistry } from "../lanka-blind-spot-registry/lankaBlindSpotRegistry";
import type { ILankaReadableVM } from "../../_interfaces/ILankaReadableVM";

export interface ILankaAccessTracker<TState extends object> {
	/**
	 * The state as a recording Proxy: every key read off it is remembered.
	 *
	 * Cached by the IDENTITY of the state it wrapped, so a second read while
	 * nothing has changed hands back the same proxy — and therefore the same
	 * recorded keys — rather than starting the recording over.
	 *
	 * A ViewModel that turned tracking off gets the state itself, and every
	 * change then notifies. That is its decision, not a fallback: it turned
	 * tracking off because it DERIVES what the screen shows, and a recording that
	 * cannot see those reads would skip renders the screen needs.
	 */
	read(): TState;
	/**
	 * Whether a change touches anything this reader actually looked at.
	 *
	 * A reader that has looked at NOTHING yet is notified of everything: it has
	 * not had the chance to record a key, and staying silent would mean its first
	 * render never arrives.
	 */
	shouldNotify(next: TState, prev: TState): boolean;
	/**
	 * Says, in development, that a change was skipped — so the framework can warn
	 * if the screen reads the changed key through a getter.
	 *
	 * Called by a binding exactly when `shouldNotify` answered `false`. In
	 * production, and for a ViewModel with no trap, it does nothing.
	 */
	reportSkipped(next: TState, prev: TState): void;
	/**
	 * The state itself, never the proxy.
	 *
	 * For a render that happens once and is thrown away — a server snapshot. There
	 * is nothing to skip on a second render that will not happen, so recording
	 * reads would be work whose result nothing consults.
	 */
	readPlain(): TState;
	/** The keys read so far. Handed to the blind-spot diagnostic, which names them. */
	readonly trackedKeys: ReadonlySet<string>;
}

const asRecord = (state: object): Record<string, unknown> => state as Record<string, unknown>;

/**
 * A view of `state` that records the keys a READER depends on.
 *
 * Three things are excluded, and each was found by a reader going deaf rather
 * than by review. What they have in common is that none of them can ever make
 * `shouldNotify` answer true — so recording one cannot cause a render, and can
 * only switch off the rule that a reader who has read NOTHING hears about
 * everything.
 *
 * **Symbols.** `shouldNotify` compares keys by name, so a recorded symbol could
 * never be consulted, and every symbol a runtime asks for while inspecting an
 * object would join the set.
 *
 * **Keys the state does not have.** A framework probes an unfamiliar object
 * before it will hold it: Vue's `shallowRef` reads `__v_isRef`, a promise
 * resolution reads `then`, React reads `$$typeof`. Each went through this proxy
 * and was recorded, and `undefined === undefined` on every later comparison.
 * That is what made `defineLankaStore(vm)` deaf to its own first change — the
 * ONE key it had recorded was `__v_isRef`, and a template reading a real key
 * during its first render is what hid it everywhere else.
 *
 * **Functions.** An action is one object for the life of the store, so a
 * recorded action can never differ. `await store.load()` before any other read
 * is the shape that found it. A state key holding a function that genuinely
 * changes is the case this gives up, and it is the right one: a callback living
 * in state is state two readers cannot agree about, and every ViewModel here and
 * in the applications keeps its functions in actions.
 */
const recordReadsInto = <TState extends object>(state: TState, keys: Set<string>): TState =>
	new Proxy(state, {
		get(target, prop, receiver) {
			const value = Reflect.get(target, prop, receiver) as unknown;

			if (
				typeof prop === "string" &&
				typeof value !== "function" &&
				Object.hasOwn(target, prop)
			) {
				keys.add(prop);
			}

			return value;
		},
	});

/**
 * The recording one reader currently holds, rebuilt when the state moves.
 *
 * Its own unit because it is the stateful half: a proxy, the keys it has
 * collected, and the identity of the state it was made for. What is left around
 * it is a comparison and a report, neither of which remembers anything.
 */
const trackedReadOf = <TState extends object>(read: () => TState) => {
	let keys = new Set<string>();
	let state: TState | null = null;
	let proxy: TState | null = null;

	return {
		keys: (): ReadonlySet<string> => keys,

		current: (): TState => {
			const next = read();
			if (state === next && proxy) return proxy;

			// A FRESH set per state: the keys a reader looks at can change between
			// renders — a branch stops being taken, a list empties — and keeping the
			// old ones would re-render for a key nobody reads any more, forever.
			keys = new Set<string>();
			state = next;
			proxy = recordReadsInto(next, keys);

			return proxy;
		},
	};
};

/** Whether the two states disagree on any of the keys a reader looked at. */
const anyKeyMoved = (keys: ReadonlySet<string>, next: object, prev: object): boolean => {
	const nextRecord = asRecord(next);
	const prevRecord = asRecord(prev);

	for (const key of keys) {
		if (!Object.is(nextRecord[key], prevRecord[key])) return true;
	}

	return false;
};

/**
 * Which state keys one reader looked at, and whether a change touched them.
 *
 * This is the whole of access tracking, and it is deliberately ignorant of how
 * anybody subscribes. A component re-renders only for keys it READ off the proxy
 * this returns; every framework asks that question the same way and answers it
 * with a different mechanism — `useSyncExternalStore`, a `shallowRef`, a signal —
 * so the question lives here and the mechanism lives in the binding.
 *
 * **This is the one piece of core a binding author needs.** It is published
 * through `lanka/extend` for exactly that: a binding is then a subscription, a
 * render trigger and these four calls, and the behaviour a consumer sees is the
 * framework's rather than each binding's re-reading of it. Canon:
 * `skills/parity/SKILL.md`.
 *
 * ## One tracker per reader, not per store
 *
 * The recorded keys are the property of whoever did the reading. Two components
 * over one ViewModel read different keys and must re-render for different
 * changes, so each holds its own tracker — which is also why this is a factory
 * with closed-over state rather than a set of pure functions over a shared map:
 * the lifetime of the recording is exactly the lifetime of the reader.
 *
 * ## The blind spot this cannot see, and reports instead
 *
 * Tracking sees reads made DIRECTLY off the proxy. A key reached only inside a
 * derived getter — an action calling `get()` — is invisible here, so a change to
 * it answers `shouldNotify` with `false` and the screen does not move. That is
 * what `reportSkipped` is for: core kept a trap for this ViewModel, and in
 * development it names the ViewModel and the key rather than leaving a frozen
 * screen with no error anywhere.
 */
export const createLankaAccessTracker = <TState extends object>(
	viewModel: ILankaReadableVM<TState>,
): ILankaAccessTracker<TState> => {
	const trap = lankaBlindSpotRegistry.of(viewModel);
	const isTracked = viewModel.isAccessTracked;
	const tracked = trackedReadOf(() => viewModel.getState());

	return {
		get trackedKeys(): ReadonlySet<string> {
			return isTracked ? tracked.keys() : new Set<string>();
		},

		read(): TState {
			return isTracked ? tracked.current() : viewModel.getState();
		},

		shouldNotify(next: TState, prev: TState): boolean {
			if (!isTracked) return true;

			const keys = tracked.keys();

			return keys.size === 0 || anyKeyMoved(keys, next, prev);
		},

		reportSkipped(next: TState, prev: TState): void {
			trap?.report(new Set(tracked.keys()), asRecord(next), asRecord(prev));
		},

		readPlain(): TState {
			return viewModel.getState();
		},
	};
};
