import {
	getCurrentInstance,
	getCurrentScope,
	onMounted,
	onScopeDispose,
	shallowRef,
	triggerRef,
} from "vue";
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

	const hear = (next: TState, prev: TState): void => {
		if (selector) {
			const picked = read();

			// Only when the SELECTION moved. Without this the ref is set on every
			// notification and the reader wakes for everything, so the same call
			// means one thing here and another in React — which is what the
			// conformance suite's selector scenes now refuse.
			if (Object.is(picked, state.value)) return;

			state.value = picked;
			triggerRef(state);

			return;
		}

		if (!tracker.shouldNotify(next, prev)) {
			// No update will follow. If the changed key is linked to this component
			// through a getter it read, the screen froze — and in development core
			// says so by name.
			tracker.reportSkipped(next, prev);
			return;
		}

		// `triggerRef` as well as the assignment: a tracked read hands back the SAME
		// proxy while the state object is unchanged, and a shallow ref compares by
		// identity — so an assignment alone would be a no-op exactly when the
		// tracker did its job. Vue re-renders, the proxy records afresh.
		state.value = read();
		triggerRef(state);
	};

	let stop = (): void => undefined;
	const start = (): void => {
		stop = viewModel.subscribe(hear);
	};
	const release = (): void => {
		stop();
	};

	/**
	 * Inside a component the subscription starts at MOUNT; everywhere else, now.
	 *
	 * A server renders once and throws the tree away. Nothing is mounted and
	 * nothing is unmounted, so the instance's scope is never stopped and
	 * `onScopeDispose` never runs — a subscription opened in `setup` there is a
	 * listener on a module-level ViewModel that outlives the request, and the
	 * process collects one per request until it dies. The conformance suite's
	 * server scene is what found it, on the day this package started answering
	 * that scene instead of skipping it.
	 *
	 * `onMounted` is the seam because it is the one lifecycle a server never
	 * reaches. Outside a component there is no mount to wait for — a module-level
	 * read, a test, an `effectScope` — and the subscription opens immediately, as
	 * it always did.
	 *
	 * The catch-up is not optional. Between `setup` and the mount the ViewModel may
	 * have moved, and the ref still holds what `setup` saw.
	 *
	 * What it compares is the STATE OBJECT, not the value the reader sees. The
	 * value was the obvious thing to compare and it is wrong on the selector arm:
	 * a selector building a fresh object — `(s) => ({ … })`, the shape a consumer
	 * reaches for first — is never `Object.is`-equal to anything, so every such
	 * component rendered a second time at mount whether or not a thing had moved.
	 * The state object is the question both arms actually mean: core answers the
	 * same one while nothing has changed.
	 *
	 * ## The window this leaves, and the trade in it
	 *
	 * A change made synchronously in `setup` AFTER this call — a bootstrap line, a
	 * hydration — is no longer in the first render; it lands on the next tick.
	 * `onBeforeMount` would close that window and open a worse one: it runs inside
	 * the hydration render, so correcting the value there makes the client paint
	 * something the server did not send. That is a markup mismatch in a process
	 * this framework owns no part of, and `skills/hosts/SKILL.md` §5 is the rule
	 * it breaks — take the frame, which is a cost inside our own layer, over a
	 * mismatch the host reports and the application cannot act on.
	 *
	 * It is a cost the other four bindings do not pay, which is the part worth
	 * knowing before anyone calls it a Vue bug.
	 */
	if (getCurrentInstance()) {
		const stateAtSetup = viewModel.getState();

		onMounted(() => {
			start();

			if (Object.is(viewModel.getState(), stateAtSetup)) return;

			state.value = read();
			triggerRef(state);
		});
	} else {
		start();
	}

	state.stop = release;

	// Inside a component or an `effectScope`, Vue owns the lifetime and the
	// subscription goes with it. Outside one there is nothing to attach to, and
	// `onScopeDispose` would warn — so the caller keeps `stop`.
	if (getCurrentScope()) onScopeDispose(release);

	return state;
}
