import { DestroyRef, assertInInjectionContext, inject, signal } from "@angular/core";
import { createLankaAccessTracker } from "lanka/extend";
import type { Signal } from "@angular/core";
import type { ILankaReadableVM } from "lanka/viewmodel";

/**
 * Reads a ViewModel from Angular.
 *
 * ```ts
 * @Component({ template: `<li *ngFor="let row of state().rows">{{ row }}</li>` })
 * export class TodoScreen {
 * 	protected readonly state = useLankaVM(todoVM);
 * }
 * ```
 *
 * Without a selector the signal carries a value that RECORDS which keys were
 * read, and changes only when one of THOSE moves. With a selector the selector
 * decides and tracking is bypassed.
 *
 * Zoneless needs no extra step: a signal is what zoneless change detection
 * reads, so this is the shape Angular is moving towards rather than a bridge to
 * it.
 *
 * ## Why an injection context is REQUIRED, not preferred
 *
 * `@lankajs/vue` and `@lankajs/solid` publish a `stop()` for a call made outside
 * their framework's scope, because both can still work without one. Angular
 * cannot: `DestroyRef` is the only way to learn that the caller has gone, and a
 * subscription with no way to learn that is a leak with no owner.
 *
 * So this refuses at the call rather than leaking quietly, and the message names
 * the fix. Where the other two degrade, this one stops — and a refusal a
 * developer reads once beats a leak found in production.
 *
 * ## What this function does NOT contain
 *
 * The recording, the comparison and the blind-spot warning are
 * `createLankaAccessTracker` in core. Every binding on this shelf calls it,
 * which is what makes "a screen updates for the keys it read" a fact about lanka
 * rather than a fact about Angular.
 */
export function useLankaVM<TState extends object>(
	viewModel: ILankaReadableVM<TState>,
): Signal<TState>;

export function useLankaVM<TState extends object, TSelected>(
	viewModel: ILankaReadableVM<TState>,
	selector: (state: TState) => TSelected,
): Signal<TSelected>;

export function useLankaVM<TState extends object, TSelected>(
	viewModel: ILankaReadableVM<TState>,
	selector?: (state: TState) => TSelected,
): Signal<TState | TSelected> {
	assertInInjectionContext(useLankaVM);

	const tracker = createLankaAccessTracker(viewModel);
	const read = (): TState | TSelected =>
		selector ? selector(viewModel.getState()) : tracker.read();

	// `equal: () => false` because a tracked read hands back the SAME proxy while
	// the state object is unchanged, and a signal compares by identity — so
	// setting it would be a no-op exactly when the tracker did its job. What
	// decides whether anything happens is `shouldNotify` below, which is the
	// framework's answer rather than the signal's.
	const state = signal<TState | TSelected>(read(), { equal: () => false });

	const stop = viewModel.subscribe((next, prev) => {
		if (selector) {
			const picked = read();

			// Only when the SELECTION moved. The signal is `equal: () => false`, so
			// setting it always wakes — which is right for a tracked read and wrong
			// for a selected one, and is what the suite's selector scenes refuse.
			if (Object.is(picked, state())) return;

			state.set(picked);

			return;
		}

		if (!tracker.shouldNotify(next, prev)) {
			// No update will follow. If the changed key is linked to this component
			// through a getter it read, the screen froze — and in development core
			// says so by name.
			tracker.reportSkipped(next, prev);
			return;
		}

		state.set(read());
	});
	inject(DestroyRef).onDestroy(stop);

	return state.asReadonly();
}
