import { createSubscriber } from "svelte/reactivity";
import { createLankaAccessTracker } from "lanka/extend";
import type { ILankaReadableVM } from "lanka/viewmodel";

/** A ViewModel read from Svelte: the state by getters, and a way to stop reading. */
/**
 * What a TRACKED read answers: the state's own keys, as getters.
 *
 * Reading one registers with Svelte's graph and with the access tracker in a
 * single access, which is why this shape and not a ref.
 */
export type TLankaVMView<TValue> = TValue & {
	stop: () => void;
};

/**
 * What a SELECTED read answers: one value, under `current`.
 *
 * `.current` is Svelte's own convention for a reactive value a class exposes —
 * `MediaQuery` and the rest of `svelte/reactivity` read that way — so a consumer
 * needs no explanation.
 *
 * A getter object rather than the state's keys, and that is not a preference. A
 * selector may answer anything, including a number, and there are no keys to
 * define on a number: the shape that carried the selection's own keys accepted
 * `TSelected extends object` and refused `(state) => state.count`, which is a
 * member of this shelf NARROWING the shared name. The conformance suite's
 * selector scenes found it.
 */
export type TLankaVMSelectedView<TSelected> = {
	readonly current: TSelected;
	stop: () => void;
};

/**
 * Reads a ViewModel from Svelte.
 *
 * ```svelte
 * <script lang="ts">
 *   const state = useLankaVM(todoVM);
 * </script>
 *
 * {#each state.todos as todo (todo.id)}
 *   <li>{todo.title}</li>
 * {/each}
 * ```
 *
 * Without a selector the view records which keys were read and updates only when
 * one of THOSE moves. With a selector the selector decides and tracking is
 * bypassed.
 *
 * ## `createSubscriber`, and not the store contract
 *
 * Svelte reads a `{ subscribe }` object as a store, and a ViewModel nearly is
 * one — the shapes differ only in that Svelte calls the listener immediately.
 * Bridging that is two lines and was rejected anyway: the store contract is
 * Svelte 4's way, it does not compose with `$state`, and a consumer would write
 * `$todoVM` where every other framework writes a plain read.
 *
 * `createSubscriber` is plain TypeScript, which is why this package needs no
 * compiler and builds like every other one here.
 *
 * ## Why the properties are getters
 *
 * Svelte's reactivity is read-driven: an effect depends on what it READ. That is
 * the same question `createLankaAccessTracker` answers, so the two line up
 * exactly — reading `state.todos` records `todos` in the tracker AND registers
 * the effect with Svelte's graph, in one access.
 *
 * ## What this function does NOT contain
 *
 * The recording, the comparison and the blind-spot warning are in core. If this
 * file ever needs more than the port gives it, the port has the defect.
 */
export function useLankaVM<TState extends object>(
	viewModel: ILankaReadableVM<TState>,
): TLankaVMView<TState>;

export function useLankaVM<TState extends object, TSelected>(
	viewModel: ILankaReadableVM<TState>,
	selector: (state: TState) => TSelected,
): TLankaVMSelectedView<TSelected>;

/**
 * The overload a WRAPPER needs: a selector it was handed, which may be absent.
 *
 * The two above describe the two things a component does, and neither accepts
 * `undefined` — so a reader forwarding its own optional argument had to branch,
 * and a branch here is two call sites where the consumer wrote one.
 * `toLankaCallableVM` in `_internal/` is such a wrapper — it is what puts this
 * package's read on the six factories — and so is every one a consumer writes
 * over this.
 *
 * The answer widens to the union of the two views because it genuinely is not
 * known which: that is the price of not knowing at the type level whether a
 * selector arrived, and a caller who does know keeps one of the two overloads
 * above. The union is two SHAPES here rather than two values, for the reason
 * `TLankaVMSelectedView` gives — a selection may be a number, and a number has
 * no keys to define getters on.
 */
export function useLankaVM<TState extends object, TSelected>(
	viewModel: ILankaReadableVM<TState>,
	selector: ((state: TState) => TSelected) | undefined,
): TLankaVMView<TState> | TLankaVMSelectedView<TSelected>;

export function useLankaVM<TState extends object, TSelected>(
	viewModel: ILankaReadableVM<TState>,
	selector?: (state: TState) => TSelected,
): TLankaVMView<TState> | TLankaVMSelectedView<TSelected> {
	const tracker = createLankaAccessTracker(viewModel);

	let stop = (): void => undefined;
	let selected: TSelected | undefined = selector ? selector(viewModel.getState()) : undefined;

	const subscribe = createSubscriber((update) => {
		stop = viewModel.subscribe((next, prev) => {
			if (selector) {
				const picked = selector(next);

				// Only when the SELECTION moved. `update()` invalidates whoever read
				// this view, and a selected reader that invalidated on every change
				// would be narrowing what it READS and nothing else — which is what
				// the suite's selector scenes refuse.
				if (Object.is(picked, selected)) return;

				selected = picked;
				update();

				return;
			}

			if (!tracker.shouldNotify(next, prev)) {
				// No update will follow. If the changed key is linked to this view
				// through a getter it read, the screen froze — and in development core
				// says so by name.
				tracker.reportSkipped(next, prev);
				return;
			}

			update();
		});

		return () => {
			stop();
		};
	});

	/**
	 * A selected read answers ONE value, under `current`.
	 *
	 * Svelte's own convention for a reactive value — `MediaQuery` and the rest of
	 * `svelte/reactivity` read that way — and the only shape that can carry a
	 * selection which is not an object.
	 */
	if (selector) {
		const selectedView = {} as Record<string, unknown>;

		Object.defineProperty(selectedView, "current", {
			enumerable: true,
			get: () => {
				subscribe();

				return selector(viewModel.getState());
			},
		});
		Object.defineProperty(selectedView, "stop", {
			enumerable: false,
			value: () => {
				stop();
			},
		});

		return selectedView as TLankaVMSelectedView<TSelected>;
	}

	/**
	 * One getter per key, over the keys the ViewModel has right now.
	 *
	 * Built from the CURRENT state rather than left to a Proxy, because Svelte's
	 * compiler and its `$inspect` walk an object's own descriptors: a Proxy would
	 * track correctly and show a consumer nothing in devtools.
	 */
	const view = {} as Record<string, unknown>;

	for (const key of Object.keys(viewModel.getState())) {
		Object.defineProperty(view, key, {
			enumerable: true,
			get: () => {
				subscribe();

				// `tracker.read()` and not a shared `read` helper: this getter is only
				// built on the TRACKED path — the selected view returns above it — so a
				// helper that branched on the selector carried an arm nothing could
				// reach, and an unreachable branch is a line no test can ever cover.
				return (tracker.read() as Record<string, unknown>)[key];
			},
		});
	}

	Object.defineProperty(view, "stop", {
		enumerable: false,
		value: () => {
			stop();
		},
	});

	return view as TLankaVMView<TState>;
}
