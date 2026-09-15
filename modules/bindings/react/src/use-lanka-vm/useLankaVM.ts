import { useCallback, useRef, useSyncExternalStore } from "react";
import { createLankaAccessTracker } from "lanka/extend";
import type { ILankaAccessTracker } from "lanka/extend";
import type { ILankaReadableVM } from "lanka/viewmodel";

/**
 * Reads a ViewModel from a React component.
 *
 * ```tsx
 * export const TodoScreen = () => {
 * 	const { todos, isLoading, load } = useLankaVM(todoVM);
 * 	…
 * };
 * ```
 *
 * Without a selector the component receives a Proxy that records which keys it
 * read, and the next change re-renders it only if one of THOSE keys moved. With
 * a selector the selector decides and tracking is bypassed.
 *
 * ## What this function does NOT contain
 *
 * The recording, the comparison and the blind-spot warning are
 * `createLankaAccessTracker` in core. Every binding on this shelf calls it, which
 * is what makes "a screen re-renders for the keys it read" a fact about lanka
 * rather than a fact about React — and what
 * `lankaViewBindingConformance` holds all of them to.
 *
 * What is left is React: a ref per mounted component, a stable `subscribe`, and
 * `useSyncExternalStore`. If this file ever needs more than the port gives it,
 * the port has the defect and the fix belongs in core, for everybody.
 *
 * ## The blind spot, unchanged
 *
 * A component re-renders only for keys it READ off the returned proxy. An action
 * that DERIVES a value reads the store through `get`, which the proxy never sees
 * — so a component whose only link to a key is such a getter never re-renders
 * for it. Set `enableAccessTrackingOptimization: false` on that ViewModel; in
 * development the mismatch announces itself by name. Canon: `skills/parity`.
 */
export function useLankaVM<TState extends object>(viewModel: ILankaReadableVM<TState>): TState;

export function useLankaVM<TState extends object, TSelected>(
	viewModel: ILankaReadableVM<TState>,
	selector: (state: TState) => TSelected,
): TSelected;

/**
 * The overload a WRAPPER needs: a selector it was handed, which may be absent.
 *
 * The two above describe the two things a screen does, and neither accepts
 * `undefined` — so a hook that forwards its own optional argument had to branch,
 * and a branch around a hook call is the one thing React's lint rule refuses
 * outright. `toLankaReactVM` is such a wrapper, and so is every wrapper a
 * consumer writes over this one.
 *
 * The answer widens to `TState | TSelected` because it genuinely is not known
 * which: that is the price of not knowing at the type level whether a selector
 * arrived, and a caller who does know keeps one of the two overloads above.
 */
export function useLankaVM<TState extends object, TSelected>(
	viewModel: ILankaReadableVM<TState>,
	selector: ((state: TState) => TSelected) | undefined,
): TState | TSelected;

export function useLankaVM<TState extends object, TSelected>(
	viewModel: ILankaReadableVM<TState>,
	selector?: (state: TState) => TSelected,
): TState | TSelected {
	// One tracker per mounted component: two components over one ViewModel read
	// different keys and must re-render for different changes. Built lazily rather
	// than as an initialiser argument, which would construct one on every render
	// and throw all but the first away.
	const trackerRef = useRef<ILankaAccessTracker<TState> | null>(null);
	trackerRef.current ??= createLankaAccessTracker(viewModel);

	/**
	 * Whether a selector was passed, which is all `subscribe` needs to know.
	 *
	 * Not the selector itself. A selector is usually an inline arrow with a new
	 * identity every render, so keying the subscription on it would tear the
	 * subscription down and rebuild it on EVERY render — the failure measured at
	 * 201 subscriptions for 200 renders. Whether there IS one is a boolean that
	 * does not change at a given call site, so the subscription stands still.
	 */
	const hasSelector = selector !== undefined;

	/**
	 * Stable identity, and the dependencies are the two things that genuinely
	 * change what the subscription DOES.
	 *
	 * `useSyncExternalStore` keeps `subscribe` in an effect keyed on its identity.
	 * A different ViewModel is a different subscription and must be rebuilt; so is
	 * switching between tracked and selected reads. Neither moves in practice —
	 * a ViewModel is a module-level object — so a mounted component subscribes
	 * once and stays subscribed.
	 */
	const subscribe = useCallback(
		(onStoreChange: () => void) =>
			viewModel.subscribe((next, prev) => {
				if (hasSelector) {
					onStoreChange();
					return;
				}

				const tracker = trackerRef.current;
				if (!tracker || tracker.shouldNotify(next, prev)) {
					onStoreChange();
					return;
				}

				// Reaching here means NO re-render will follow. If the changed key is
				// linked to this component through a getter it read, the screen froze —
				// and in development core says so by name.
				tracker.reportSkipped(next, prev);
			}),
		[viewModel, hasSelector],
	);

	/**
	 * Read during render, so it may close over this render's selector directly.
	 *
	 * `getSnapshot` is not kept in an effect and has no stability requirement —
	 * which is what lets the selector stay a plain argument. The alternative was a
	 * ref written during render to keep the latest one, and a ref written during
	 * render is an impure render that React's own lint rule refuses.
	 */
	const readTracked = (): TState | TSelected =>
		selector
			? selector(viewModel.getState())
			: (trackerRef.current?.read() ?? viewModel.getState());

	/**
	 * The server snapshot: the state itself, never the Proxy.
	 *
	 * Tracking exists to skip renders a client would otherwise do; a server
	 * renders once, and handing it a recording Proxy would only add work whose
	 * result nothing reads.
	 */
	const readUntracked = (): TState | TSelected => {
		const state = viewModel.getState();

		return selector ? selector(state) : state;
	};

	return useSyncExternalStore(subscribe, readTracked, readUntracked);
}
