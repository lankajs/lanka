import { createSignal, getOwner, onCleanup } from "solid-js";
import { createLankaAccessTracker } from "lanka/extend";
import type { Accessor } from "solid-js";
import type { ILankaReadableVM } from "lanka/viewmodel";

/** A ViewModel read from Solid: an accessor, and a way to stop reading it. */
export type TLankaVMAccessor<TValue> = Accessor<TValue> & {
	/**
	 * Releases the subscription.
	 *
	 * Called for you by `onCleanup` inside a component or a root. It is published
	 * because a read made where there is no owner — module level, a test — has
	 * nobody to call it, and Solid warns about that case rather than handling it.
	 */
	stop: () => void;
};

/**
 * Reads a ViewModel from Solid.
 *
 * ```tsx
 * export const TodoScreen = () => {
 * 	const state = useLankaVM(todoVM);
 *
 * 	return <For each={state().todos}>{(todo) => <li>{todo.title}</li>}</For>;
 * };
 * ```
 *
 * Without a selector the accessor answers a Proxy that records which keys were
 * read, and the signal changes only when one of THOSE moves. With a selector the
 * selector decides and tracking is bypassed.
 *
 * ## Why tracking still earns its place here
 *
 * Solid already skips work a signal did not feed, so a coarse binding would be
 * less wrong here than elsewhere. It would still be wrong: without tracking every
 * change writes a new object into the signal, and every effect reading ANY part
 * of it re-runs. The tracker is what keeps the signal UNCHANGED when nothing a
 * reader looked at moved — and an unchanged signal is work Solid never starts.
 *
 * ## What "a render" means in a framework that has none
 *
 * A Solid component runs once; what updates is the DOM node that read the signal.
 * So there is nothing here that corresponds to a re-render, and the conformance
 * suite's `renders()` counts the reading effect's runs instead — which is the
 * closest question this framework can be asked.
 *
 * ## What this function does NOT contain
 *
 * The recording, the comparison and the blind-spot warning are in core. If this
 * file ever needs more than the port gives it, the port has the defect.
 */
export function useLankaVM<TState extends object>(
	viewModel: ILankaReadableVM<TState>,
): TLankaVMAccessor<TState>;

export function useLankaVM<TState extends object, TSelected>(
	viewModel: ILankaReadableVM<TState>,
	selector: (state: TState) => TSelected,
): TLankaVMAccessor<TSelected>;

/**
 * The overload a WRAPPER needs: a selector it was handed, which may be absent.
 *
 * The two above describe the two things a component does, and neither accepts
 * `undefined` — so a function forwarding its own optional argument had to
 * branch, and a branch is two call sites of something that opens a subscription
 * and registers an `onCleanup`. `toLankaCallableVM` is such a wrapper, and so is
 * every wrapper a consumer writes over this one.
 *
 * The answer widens to `TState | TSelected` because it genuinely is not known
 * which: that is the price of not knowing at the type level whether a selector
 * arrived, and a caller who does know keeps one of the two overloads above.
 *
 * It is `@lankajs/react`'s third overload, spelled for Solid's answer, and it is
 * here for the same reason — the shelf's six factories are one wrapper per
 * member over the member's own read.
 */
export function useLankaVM<TState extends object, TSelected>(
	viewModel: ILankaReadableVM<TState>,
	selector: ((state: TState) => TSelected) | undefined,
): TLankaVMAccessor<TState | TSelected>;

export function useLankaVM<TState extends object, TSelected>(
	viewModel: ILankaReadableVM<TState>,
	selector?: (state: TState) => TSelected,
): TLankaVMAccessor<TState | TSelected> {
	const tracker = createLankaAccessTracker(viewModel);
	const read = (): TState | TSelected =>
		selector ? selector(viewModel.getState()) : tracker.read();

	// `equals: false` because a tracked read hands back the SAME proxy while the
	// state object is unchanged, and Solid compares by identity — so setting it
	// would be a no-op exactly when the tracker did its job. What decides whether
	// anything happens is `shouldNotify` below, which is the framework's answer
	// rather than the signal's.
	const [state, setState] = createSignal<TState | TSelected>(read(), { equals: false });

	const stop = viewModel.subscribe((next, prev) => {
		if (selector) {
			const picked = read();

			// Only when the SELECTION moved. The signal is `equals: false`, so
			// setting it always wakes — which is right for a tracked read and wrong
			// for a selected one, and is what the suite's selector scenes refuse.
			if (Object.is(picked, state())) return;

			setState(() => picked);

			return;
		}

		if (!tracker.shouldNotify(next, prev)) {
			// No update will follow. If the changed key is linked to this reader
			// through a getter it read, the screen froze — and in development core
			// says so by name.
			tracker.reportSkipped(next, prev);
			return;
		}

		setState(() => read());
	});
	const accessor = state as TLankaVMAccessor<TState | TSelected>;
	accessor.stop = stop;

	// Inside a component or a root, Solid owns the lifetime and the subscription
	// goes with it. Outside one there is no owner, and `onCleanup` would warn —
	// so the caller keeps `stop`.
	if (getOwner()) onCleanup(stop);

	return accessor;
}
