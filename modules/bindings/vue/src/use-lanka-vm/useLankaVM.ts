import { getCurrentScope, onScopeDispose, shallowRef, triggerRef } from "vue";
import { createLankaAccessTracker } from "lanka/extend";
import type { ShallowRef } from "vue";
import type { ILankaReadableVM } from "lanka/viewmodel";

/** A ViewModel read from Vue: a ref, and a way to stop reading it. */
export interface ILankaVMRef<TValue> extends ShallowRef<TValue> {
	/**
	 * Releases the subscription.
	 *
	 * Called for you by `onScopeDispose` inside a component or an `effectScope`.
	 * It is published because a read made OUTSIDE a scope — at module level, in a
	 * test — has nobody to call it, and Vue says nothing about that case.
	 */
	stop: () => void;
}

/**
 * Reads a ViewModel from a Vue component.
 *
 * ```vue
 * <script setup lang="ts">
 * const state = useLankaVM(todoVM);
 * </script>
 *
 * <template>
 *   <li v-for="todo in state.todos" :key="todo.id">{{ todo.title }}</li>
 * </template>
 * ```
 *
 * Without a selector the component receives a Proxy that records which keys it
 * read, and the next change updates the ref only if one of THOSE keys moved.
 * With a selector the selector decides and tracking is bypassed.
 *
 * ## What a Vue call answers, and why React's answers differently
 *
 * A `ShallowRef`. A template unwraps it (`state.todos`) and a script does not
 * (`state.value.todos`), which is Vue's own idea of reactivity — and the one
 * thing this shelf deliberately does NOT hide. Flattening it would mean a second
 * reactivity system fighting the first, and every `watch` a consumer writes
 * would stop seeing changes.
 *
 * Everything else is the same as every other binding, and
 * `lankaViewBindingConformance` is what says so rather than this paragraph.
 *
 * ## What this function does NOT contain
 *
 * The recording, the comparison and the blind-spot warning are
 * `createLankaAccessTracker` in core. If this file ever needs more than the port
 * gives it, the port has the defect and the fix belongs in core, for everybody.
 */
export function useLankaVM<TState extends object>(
	viewModel: ILankaReadableVM<TState>,
): ILankaVMRef<TState>;

export function useLankaVM<TState extends object, TSelected>(
	viewModel: ILankaReadableVM<TState>,
	selector: (state: TState) => TSelected,
): ILankaVMRef<TSelected>;

export function useLankaVM<TState extends object, TSelected>(
	viewModel: ILankaReadableVM<TState>,
	selector?: (state: TState) => TSelected,
): ILankaVMRef<TState | TSelected> {
	const tracker = createLankaAccessTracker(viewModel);
	const read = (): TState | TSelected =>
		selector ? selector(viewModel.getState()) : tracker.read();

	// `as unknown` first: Vue's `shallowRef` return type is a conditional over the
	// value, and TypeScript cannot see that adding `stop` to it lands on this
	// interface. The object IS the ref — `stop` is assigned two lines below.
	const state = shallowRef(read()) as unknown as ILankaVMRef<TState | TSelected>;

	const stop = viewModel.subscribe((next, prev) => {
		if (!selector && !tracker.shouldNotify(next, prev)) {
			// No update will follow. If the changed key is linked to this component
			// through a getter it read, the screen froze — and in development core
			// says so by name.
			tracker.reportSkipped(next, prev);
			return;
		}

		const value = read();

		// `triggerRef` as well as the assignment: a tracked read hands back the SAME
		// proxy while the state object is unchanged, and a shallow ref compares by
		// identity — so an assignment alone would be a no-op exactly when the
		// tracker did its job. Vue re-renders, the proxy records afresh.
		state.value = value;
		triggerRef(state);
	});

	state.stop = stop;

	// Inside a component or an `effectScope`, Vue owns the lifetime and the
	// subscription goes with it. Outside one there is nothing to attach to, and
	// `onScopeDispose` would warn — so the caller keeps `stop`.
	if (getCurrentScope()) onScopeDispose(stop);

	return state;
}
