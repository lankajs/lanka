import { createLankaAccessTracker } from "../../_internal/create-lanka-access-tracker/createLankaAccessTracker";
import type { ILankaReadableVM } from "../../_interfaces/ILankaReadableVM";

/** One reader's live view of a ViewModel. */
export interface ILankaViewSubscription<TState extends object> {
	/**
	 * The current state, RECORDED.
	 *
	 * Every key read off it is remembered, which is what lets the next change be
	 * skipped when it touched none of them. Call it again on every read: it asks
	 * the ViewModel for its state each time, so it is never a snapshot.
	 */
	read: () => TState;
	/** Releases the subscription. */
	stop: () => void;
}

/**
 * The whole of what a view binding is, minus the framework.
 *
 * ```ts
 * // a binding for a framework this repository has never heard of
 * export const useMyFrameworkVM = (viewModel) => {
 * 	const view = createLankaViewSubscription(viewModel, () => invalidate());
 * 	onTeardown(view.stop);
 *
 * 	return view.read;
 * };
 * ```
 *
 * Subscribe, ask whether the change touched anything this reader looked at,
 * report the skip so the blind-spot diagnostic can fire, and hand back a read
 * that records. Five packages wrote those four steps out by hand, identically —
 * and five copies of a decision diverge on the day one of them gains a line.
 *
 * ## What a caller still owns
 *
 * `onChange` and the teardown, which are the only framework-shaped things left.
 * That is the seam: a binding says how its framework is WOKEN and when a reader
 * has gone, and everything about which changes are worth waking for is here.
 *
 * ## Why it does not take a selector
 *
 * A selector BYPASSES tracking — the selector decides, and there is nothing to
 * record — so a subscription that took one would be two mechanisms behind one
 * name, each right half the time. A binding with a selector arm calls
 * `createLankaAccessTracker` directly, which is what the shelf's members do, and
 * the four steps are worth writing out where they genuinely differ.
 *
 * ## What it is not
 *
 * Not a store, not a cache, not a second place state lives. It holds a tracker
 * and an unsubscribe, and everything it answers comes from the ViewModel on the
 * call.
 */
export const createLankaViewSubscription = <TState extends object>(
	viewModel: ILankaReadableVM<TState>,
	onChange: () => void,
): ILankaViewSubscription<TState> => {
	const tracker = createLankaAccessTracker(viewModel);

	const stop = viewModel.subscribe((next, prev) => {
		if (!tracker.shouldNotify(next, prev)) {
			// No update will follow. If the changed key is linked to this reader
			// through a getter it read, the screen froze — and in development core
			// names the ViewModel and the key rather than leaving it silent.
			tracker.reportSkipped(next, prev);
			return;
		}

		onChange();
	});

	return { read: () => tracker.read(), stop };
};
