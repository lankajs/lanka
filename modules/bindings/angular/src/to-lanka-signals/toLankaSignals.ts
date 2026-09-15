import { DestroyRef, assertInInjectionContext, computed, inject, signal } from "@angular/core";
import { createLankaAccessTracker } from "lanka/extend";
import type { Signal } from "@angular/core";
import type { ILankaReadableVM } from "lanka/viewmodel";

/**
 * A ViewModel split the way an Angular service exposes state: a signal per
 * value, and the actions as themselves.
 *
 * An action is one object for the life of the store, so wrapping it in a signal
 * would make every call site write `load()()`. A value changes, so it is a
 * signal; a function does not, so it is a function.
 */
export type TLankaSignals<TState extends object> = {
	[TKey in keyof TState]: TState[TKey] extends (...args: never[]) => unknown
		? TState[TKey]
		: Signal<TState[TKey]>;
};

/**
 * Reads a ViewModel as the signals an Angular component expects.
 *
 * ```ts
 * @Component({ template: `@if (todos.isLoading()) { … } @for (row of todos.rows(); track row) { … }` })
 * export class TodoScreen {
 * 	protected readonly todos = toLankaSignals(todosVM);
 * }
 * ```
 *
 * ## Why this exists beside `useLankaVM`
 *
 * `useLankaVM` answers ONE `Signal` over the whole state, which is the shape
 * every other binding on the shelf parallels: `state().rows`. It is also not how
 * Angular holds state. An Angular service exposes a signal per field —
 * `readonly rows = signal([])` — and a template reads `rows()`, never
 * `state().rows`. A consumer with that habit reaches for `todos.rows()` and finds
 * a call on a plain object.
 *
 * ## One subscription, and each signal is a `computed` over it
 *
 * There is one `subscribe` on the ViewModel and one version signal behind every
 * field, so a change wakes Angular once and each `computed` decides for itself
 * whether its own value moved. That is Angular's own deduplication — a `computed`
 * whose result is unchanged notifies nobody — arriving for free, and it is why
 * this is not a second subscription per field.
 *
 * ## The keys are read ONCE, at the call
 *
 * A ViewModel declares its state up front, so the field list is fixed at the
 * moment this is called. A key added to the state later has no signal here, and
 * that is the price of the shape: Angular's own services name their fields too.
 * `useLankaVM` is the answer for a state whose shape is genuinely dynamic.
 *
 * ## It needs an injection context, for the reason `useLankaVM` does
 *
 * `DestroyRef` is the only way to learn the caller has gone, and a subscription
 * that cannot learn that is a leak with no owner.
 */
export const toLankaSignals = <TState extends object>(
	viewModel: ILankaReadableVM<TState>,
): TLankaSignals<TState> => {
	assertInInjectionContext(toLankaSignals);

	const tracker = createLankaAccessTracker(viewModel);
	const version = signal(0);

	const stop = viewModel.subscribe((next, prev) => {
		if (!tracker.shouldNotify(next, prev)) {
			// No update will follow. If a changed key is linked to this reader
			// through a getter it read, the screen froze — and in development core
			// says so by name.
			tracker.reportSkipped(next, prev);
			return;
		}

		version.update((seen) => seen + 1);
	});

	inject(DestroyRef).onDestroy(stop);

	const signals = {} as Record<string, unknown>;

	for (const [key, value] of Object.entries(viewModel.getState())) {
		signals[key] =
			typeof value === "function"
				? value
				: computed(() => {
						// Read for the DEPENDENCY, discard the number. The value itself
						// comes from a tracked read, so the key is recorded and this
						// reader is woken only for the keys it actually has signals for.
						version();

						return (tracker.read() as Record<string, unknown>)[key];
					});
	}

	return signals as TLankaSignals<TState>;
};
