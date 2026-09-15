import { createSubscriber } from "svelte/reactivity";
import { createLankaAccessTracker } from "lanka/extend";
import type { ILankaReadableVM } from "lanka/viewmodel";

/** A ViewModel read from Svelte: the state by getters, and a way to stop reading. */
export type TLankaVMView<TValue> = TValue & {
	/**
	 * Releases the subscription.
	 *
	 * `createSubscriber` releases it for you when the last effect reading this
	 * view is destroyed, which is every case inside a component. This is for a
	 * read made where there is no effect at all — a module-level snapshot, a test.
	 */
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

export function useLankaVM<TState extends object, TSelected extends object>(
	viewModel: ILankaReadableVM<TState>,
	selector: (state: TState) => TSelected,
): TLankaVMView<TSelected>;

export function useLankaVM<TState extends object, TSelected extends object>(
	viewModel: ILankaReadableVM<TState>,
	selector?: (state: TState) => TSelected,
): TLankaVMView<TState | TSelected> {
	const tracker = createLankaAccessTracker(viewModel);
	let stop = (): void => undefined;

	const subscribe = createSubscriber((update) => {
		stop = viewModel.subscribe((next, prev) => {
			if (!selector && !tracker.shouldNotify(next, prev)) {
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

	const read = (): TState | TSelected =>
		selector ? selector(viewModel.getState()) : tracker.read();

	/**
	 * One getter per key, over the keys the ViewModel has right now.
	 *
	 * Built from the CURRENT state rather than left to a Proxy, because Svelte's
	 * compiler and its `$inspect` walk an object's own descriptors: a Proxy would
	 * track correctly and show a consumer nothing in devtools. A key added later
	 * is reached through `stop`-free re-reads in a template, which is how a
	 * template reads anyway.
	 */
	const view = {} as Record<string, unknown>;

	for (const key of Object.keys(viewModel.getState())) {
		Object.defineProperty(view, key, {
			enumerable: true,
			get: () => {
				subscribe();

				return (read() as Record<string, unknown>)[key];
			},
		});
	}

	Object.defineProperty(view, "stop", {
		enumerable: false,
		value: () => {
			stop();
		},
	});

	return view as TLankaVMView<TState | TSelected>;
}
