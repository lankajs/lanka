import { describe, expect, it, vi } from "vitest";
import { createEffect, createRoot } from "solid-js";
import { createLankaVM } from "lanka/viewmodel";
import { useLankaVM } from "./useLankaVM";
import type { ILankaReadableVM } from "lanka/viewmodel";
import type { TLankaVMAccessor } from "./useLankaVM";

/**
 * What is Solid-specific about `useLankaVM`, held apart from the scenes
 * `_playground/conformance.test.tsx` already runs for this package.
 *
 * The conformance suite proves the PORT is honoured — tracked reads, selectors,
 * every VM shape. What is here instead is what only exists because Solid has an
 * ownership graph and a signal that compares values: the owner-less call, a
 * root's own disposal, and the reason the signal is built with `equals: false`.
 */

interface ICounterState {
	watched: number;
	ignored: number;
	[key: string]: unknown;
}

interface ICounterActions {
	bumpWatched: () => void;
}

const createCounterVM = () =>
	createLankaVM<ICounterState, ICounterActions>({
		name: "UseLankaVMSpecCounter",
		states: { watched: 0, ignored: 0 },
		createActions: ({ set, get }) => ({
			bumpWatched: () => {
				set({ watched: get().watched + 1 });
			},
		}),
	});

describe("useLankaVM — called with no owner", () => {
	it("answers a working accessor without warning, and stop() alone releases it", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const viewModel = createCounterVM();

		// No `createRoot`, no component: at this line there is no owner, which is
		// exactly the case `onCleanup` warns about unless `useLankaVM` guards it.
		const accessor = useLankaVM(viewModel);

		expect(warn).not.toHaveBeenCalled();

		let notifications = 0;
		const dispose = createRoot((rootDispose) => {
			createEffect(() => {
				void accessor().watched;
				notifications += 1;
			});
			return rootDispose;
		});

		const beforeStop = notifications;
		viewModel.getState().bumpWatched();
		expect(notifications).toBeGreaterThan(beforeStop);

		accessor.stop();

		const afterStop = notifications;
		viewModel.getState().bumpWatched();
		viewModel.getState().bumpWatched();

		// Counted rather than asserted on a mock: a double whose `stop` merely
		// records a call would pass even if it were wired to the wrong
		// subscription. What must actually stop is the FLOW of notifications.
		expect(notifications).toBe(afterStop);

		dispose();
		warn.mockRestore();
	});

	it("survives stop() called twice", () => {
		const viewModel = createCounterVM();
		const accessor = useLankaVM(viewModel);

		accessor.stop();

		expect(() => {
			accessor.stop();
		}).not.toThrow();
	});
});

describe("useLankaVM — called inside a root", () => {
	it("releases the subscription when the owning root disposes, with no stop() call", () => {
		const viewModel = createCounterVM();
		let accessor!: TLankaVMAccessor<ICounterState>;
		let notifications = 0;

		const dispose = createRoot((rootDispose) => {
			accessor = useLankaVM(viewModel);
			createEffect(() => {
				void accessor().watched;
				notifications += 1;
			});
			return rootDispose;
		});

		const beforeDispose = notifications;
		viewModel.getState().bumpWatched();
		expect(notifications).toBeGreaterThan(beforeDispose);

		// `stop` is never called here: disposing the root is what must release it.
		dispose();

		const afterDispose = notifications;
		viewModel.getState().bumpWatched();

		expect(notifications).toBe(afterDispose);
	});
});

describe("useLankaVM — the selector arm", () => {
	it("answers an accessor of the selection, not the source state", () => {
		const viewModel = createCounterVM();

		const selected = useLankaVM(viewModel, (state) => state.watched);

		expect(selected()).toBe(0);
		expect(typeof selected.stop).toBe("function");

		selected.stop();
	});
});

describe("useLankaVM — why the signal is `equals: false`", () => {
	it("wakes a reader on a tracked change even though the value it reads is reference-identical", () => {
		/*
		 * A hand-built ViewModel whose state is mutated IN PLACE rather than
		 * replaced — legal by the port, which says nothing about how `getState`
		 * produces its answer. The access tracker caches its proxy by the STATE
		 * object's own identity, so this is exactly the shape where that cache
		 * hands back the SAME proxy after a real, tracked change. If the signal
		 * compared by identity instead of `equals: false`, it would see the value
		 * it already held and never wake the effect below.
		 */
		const state: ICounterState = { watched: 0, ignored: 0 };
		const listeners = new Set<(next: ICounterState, prev: ICounterState) => void>();
		const viewModel: ILankaReadableVM<ICounterState> = {
			name: "MutatingFakeVM",
			isAccessTracked: true,
			getState: () => state,
			subscribe: (listener) => {
				listeners.add(listener);
				return () => {
					listeners.delete(listener);
				};
			},
		};

		const accessor = useLankaVM(viewModel);
		let notifications = 0;
		let lastWatched = -1;

		const dispose = createRoot((rootDispose) => {
			createEffect(() => {
				lastWatched = accessor().watched;
				notifications += 1;
			});
			return rootDispose;
		});

		const proxyBefore = accessor();
		const before = notifications;

		const prev = { ...state };
		state.watched += 1;
		listeners.forEach((listener) => {
			listener(state, prev);
		});

		// The case that breaks a signal comparing by identity: the object the
		// effect reads did not change reference…
		expect(accessor()).toBe(proxyBefore);
		// …and yet the change must still be seen.
		expect(notifications).toBeGreaterThan(before);
		expect(lastWatched).toBe(1);

		accessor.stop();
		dispose();
	});
});
