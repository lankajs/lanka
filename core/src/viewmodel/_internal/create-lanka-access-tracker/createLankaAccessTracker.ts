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
 * A view of `state` that adds every string key read off it to `keys`.
 *
 * Only strings: `shouldNotify` compares keys by name, so a recorded symbol could
 * never be consulted — and every symbol a runtime asks for while inspecting an
 * object would join the set and make the reader re-render for nothing.
 */
const recordReadsInto = <TState extends object>(state: TState, keys: Set<string>): TState =>
	new Proxy(state, {
		get(target, prop, receiver) {
			if (typeof prop === "string") keys.add(prop);
			return Reflect.get(target, prop, receiver) as unknown;
		},
	});

/** A recording over one state, and the set it records into. */
const startRecording = <TState extends object>(
	state: TState,
): { keys: Set<string>; proxy: TState } => {
	// A FRESH set per state: the keys a reader looks at can change between renders
	// — a branch stops being taken, a list empties — and keeping the old ones would
	// re-render for a key nobody reads any more, forever.
	const keys = new Set<string>();

	return { keys, proxy: recordReadsInto(state, keys) };
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

	let trackedKeys = new Set<string>();
	let trackedState: TState | null = null;
	let trackedProxy: TState | null = null;

	return {
		get trackedKeys(): ReadonlySet<string> {
			return trackedKeys;
		},

		read(): TState {
			const state = viewModel.getState();

			if (!isTracked) return state;
			if (trackedState === state && trackedProxy) return trackedProxy;

			const started = startRecording(state);

			trackedKeys = started.keys;
			trackedState = state;
			trackedProxy = started.proxy;

			return trackedProxy;
		},

		shouldNotify(next: TState, prev: TState): boolean {
			if (!isTracked) return true;

			return trackedKeys.size === 0 || anyKeyMoved(trackedKeys, next, prev);
		},

		reportSkipped(next: TState, prev: TState): void {
			trap?.report(new Set(trackedKeys), asRecord(next), asRecord(prev));
		},

		readPlain(): TState {
			return viewModel.getState();
		},
	};
};
