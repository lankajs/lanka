import { describe, expect, it, vi } from "vitest";
import {
	createApp,
	createSSRApp,
	defineComponent,
	effectScope,
	h,
	isRef,
	isShallow,
	nextTick,
	watch,
} from "vue";
import { renderToString } from "vue/server-renderer";
import { render } from "@testing-library/vue";
import { createLankaVM } from "lanka/viewmodel";
import { useLankaVM } from "./useLankaVM";
import type { ILankaReadableVM } from "lanka/viewmodel";

/**
 * What is Vue-specific about `useLankaVM`, and unproven by the shelf-wide
 * conformance suite.
 *
 * `lankaViewBindingConformance` (run for this package in
 * `_playground/conformance.test.ts`) already pins first render, tracked
 * re-render, staleness, untracked keys, tracking-off, unmount, two readers,
 * every VM shape, the selector arms, batching, actions and the moving read set —
 * all of it through a MOUNTED component. Nothing in that suite calls
 * `useLankaVM` bare, outside a component, which is the one thing Vue lets a
 * caller do that React's hook rules forbid — and it is where `stop` and
 * `effectScope` live. What a mounted component sees once the subscription
 * itself starts at `onMounted` rather than at `setup` is pinned here too, since
 * a reader deleting that deferral would otherwise have nothing local to fail.
 */

const createCounterVM = () =>
	createLankaVM<{ count: number }, { bump: () => void }>({
		name: "UseLankaVMSpecCounter",
		states: { count: 0 },
		createActions: ({ set, get }) => ({
			bump: () => {
				set({ count: get().count + 1 });
			},
		}),
	});

describe("a call made outside any component or effectScope", () => {
	it("keeps the subscription open until `stop()` is called — nothing tears it down for you", async () => {
		const counterVM = createCounterVM();
		const ref = useLankaVM(counterVM);
		void ref.value.count; // the read a template would make, so the tracker records the key

		// Default (batched) flush, not `sync`: the tracked branch triggers once
		// through the assignment and once explicitly through `triggerRef`, and only
		// the scheduler's own dedup — the same one a real render goes through —
		// collapses that into the single settled value a watcher ever sees.
		let notifications = 0;
		const stopWatching = watch(ref, () => {
			notifications += 1;
		});

		counterVM.getState().bump();
		await nextTick();
		expect(notifications).toBe(1);

		ref.stop();
		counterVM.getState().bump();
		await nextTick();

		// Counted, not spied: if `stop()` were a no-op this would be 2, because
		// nothing outside a scope would otherwise have released the subscription.
		expect(notifications).toBe(1);
		stopWatching();
	});
});

describe("a call made inside an effectScope", () => {
	it("releases the subscription when the scope is disposed, with no `stop()` call anywhere", async () => {
		const counterVM = createCounterVM();
		const scope = effectScope();
		let ref!: ReturnType<typeof useLankaVM<{ count: number }>>;

		scope.run(() => {
			ref = useLankaVM(counterVM);
		});
		void ref.value.count;

		// Watched from OUTSIDE the scope: an effect declared inside it would be
		// disposed by `scope.stop()` too, and could no longer distinguish "the
		// watcher died" from "the subscription died" — this one survives either way.
		let notifications = 0;
		const stopWatching = watch(ref, () => {
			notifications += 1;
		});

		counterVM.getState().bump();
		await nextTick();
		expect(notifications).toBe(1);

		scope.stop();
		counterVM.getState().bump();
		await nextTick();

		expect(notifications).toBe(1);
		stopWatching();
	});
});

describe("`stop()` called more than once", () => {
	it("does nothing the second time, and does not throw", () => {
		const counterVM = createCounterVM();
		const ref = useLankaVM(counterVM);

		ref.stop();
		expect(() => {
			ref.stop();
		}).not.toThrow();
	});
});

describe("the shallow ref shape", () => {
	it("is a real Vue shallowRef, not merely an object shaped like one", () => {
		const counterVM = createCounterVM();
		const ref = useLankaVM(counterVM);

		expect(isRef(ref)).toBe(true);
		expect(isShallow(ref)).toBe(true);
		expect(typeof ref.stop).toBe("function");
		ref.stop();
	});

	it("makes a tracked change visible even when the recorded proxy's identity did not move", () => {
		/*
		 * A ViewModel need only satisfy `getState`/`subscribe` — nothing in the port
		 * forbids mutating one object in place instead of building a fresh one per
		 * write. The access tracker then caches its proxy by the IDENTITY of what
		 * `getState()` answers, so a VM shaped this way hands back the SAME proxy on
		 * every read, and a shallowRef comparing by identity would see no change to
		 * assign. `triggerRef` is the line that exists for exactly this VM, and
		 * nothing else in this package's suites builds one.
		 */
		const state = { count: 0 };
		const listeners = new Set<(next: typeof state, prev: typeof state) => void>();
		const mutatingVM: ILankaReadableVM<{ count: number }> = {
			name: "MutatingVM",
			isAccessTracked: true,
			getState: () => state,
			subscribe: (listener) => {
				listeners.add(listener);
				return () => listeners.delete(listener);
			},
		};

		const ref = useLankaVM(mutatingVM);
		void ref.value.count;

		let seen = -1;
		const stopWatching = watch(
			ref,
			() => {
				seen = ref.value.count;
			},
			{ flush: "sync" },
		);

		const prev = { ...state };
		state.count += 1;
		for (const listener of listeners) listener(state, prev);

		expect(seen).toBe(1);
		stopWatching();
		ref.stop();
	});
});

describe("the selector arm", () => {
	it("answers a ref of the SELECTION, not the whole state", () => {
		const counterVM = createCounterVM();
		const ref = useLankaVM(counterVM, (state) => state.count * 10);

		expect(ref.value).toBe(0);

		counterVM.getState().bump();

		expect(ref.value).toBe(10);
		ref.stop();
	});
});

describe("used inside a mounted component", () => {
	it("subscribes at mount and catches up on a change that landed during `setup`", async () => {
		/*
		 * The subscription now opens in `onMounted`, not in `setup` — a server
		 * never reaches that lifecycle, so it never leaks a listener on a
		 * module-level ViewModel. The cost of that deferral is a window between
		 * `setup` and the mount that follows it where a change could land unheard;
		 * this is that window, forced open on purpose, and the assertion is that
		 * the ref shows the CURRENT count once mounted rather than the one `setup`
		 * saw.
		 */
		const counterVM = createCounterVM();
		let ref!: ReturnType<typeof useLankaVM<{ count: number }>>;

		const Screen = defineComponent({
			setup() {
				ref = useLankaVM(counterVM);
				counterVM.getState().bump(); // moves the VM before the mount `ref` will catch up on
				return () => h("span");
			},
		});

		render(Screen);
		await nextTick();

		expect(ref.value.count).toBe(1);
		ref.stop();
	});
});

interface ICatchUpState {
	title: string;
	other: number;
}

interface ICatchUpActions {
	rename: (title: string) => void;
	bumpOther: () => void;
}

describe("the catch-up at mount", () => {
	it("does NOT render a second time when a fresh-object selector changed nothing", async () => {
		/*
		 * The catch-up compares the STATE object, not the value the reader sees.
		 *
		 * Comparing the value was the obvious thing and it is wrong here: a
		 * selector building a fresh object is never `Object.is`-equal to anything,
		 * so every component using the commonest selector there is rendered twice
		 * at mount whether or not the ViewModel had moved. Nothing saw it — the
		 * conformance suite's selector scenes pick a NUMBER, which compares equal.
		 */
		const viewModel = createLankaVM<ICatchUpState, ICatchUpActions>({
			name: "CatchUpSelectorVM",
			states: { title: "alpha", other: 0 },
			createActions: ({ set, get }) => ({
				rename: (title) => set({ title }),
				bumpOther: () => set({ other: get().other + 1 }),
			}),
		});
		let renders = 0;

		const Screen = defineComponent({
			setup() {
				const picked = useLankaVM(viewModel, (state) => ({ title: state.title }));

				return () => {
					renders += 1;

					return h("span", picked.value.title);
				};
			},
		});

		const app = createApp(Screen);
		app.mount(document.createElement("div"));
		await nextTick();

		expect(renders).toBe(1);
		app.unmount();
	});

	it("catches up a change that landed between setup and mount", async () => {
		// The other half, and the reason the catch-up is there at all: the
		// subscription does not exist yet while `setup` is still running, so a
		// change made after this call has nothing listening to it.
		const viewModel = createLankaVM<ICatchUpState, ICatchUpActions>({
			name: "CatchUpTrackedVM",
			states: { title: "alpha", other: 0 },
			createActions: ({ set, get }) => ({
				rename: (title) => set({ title }),
				bumpOther: () => set({ other: get().other + 1 }),
			}),
		});
		const seen: string[] = [];

		const Screen = defineComponent({
			setup() {
				const state = useLankaVM(viewModel);
				viewModel.getState().rename("beta");

				return () => {
					seen.push(state.value.title);

					return h("span", state.value.title);
				};
			},
		});

		const app = createApp(Screen);
		app.mount(document.createElement("div"));
		await nextTick();

		expect(seen.at(-1)).toBe("beta");
		app.unmount();
	});
});

describe("on a server, where nothing is ever mounted", () => {
	it("subscribes to nothing when `setup` SUSPENDS before finishing", async () => {
		/*
		 * The hard half of the server case, and the one the old excuse named.
		 *
		 * The shelf's server scene renders a component whose `setup` returns
		 * immediately, and `_playground/conformance.test.ts` answers it. An async
		 * `setup` — a top-level `await` in `<script setup>`, a Suspense boundary —
		 * is the shape that used to be the reason for skipping the scene
		 * altogether: the render suspends, resumes on a later tick and finishes in
		 * a different turn from the one it started in.
		 *
		 * A subscription opened anywhere in that sequence is a listener on a
		 * module-level ViewModel that nothing will ever release, because a server
		 * unmounts nothing. Asserted on the SUBSCRIPTION rather than on the string,
		 * because the string was never in doubt.
		 */
		const viewModel = createLankaVM<ICatchUpState, ICatchUpActions>({
			name: "SuspendingSsrVM",
			states: { title: "alpha", other: 0 },
			createActions: ({ set, get }) => ({
				rename: (title) => set({ title }),
				bumpOther: () => set({ other: get().other + 1 }),
			}),
		});
		const subscribe = vi.spyOn(viewModel, "subscribe");

		const Screen = defineComponent({
			async setup() {
				const state = useLankaVM(viewModel);
				await Promise.resolve();

				return () => h("span", state.value.title);
			},
		});

		const html = await renderToString(createSSRApp(Screen));

		expect(html).toContain("alpha");
		expect(subscribe).not.toHaveBeenCalled();
	});
});
