/**
 * What is Svelte-SPECIFIC about reading a ViewModel from this binding: the
 * getters the tracked shape answers, what the selected shape carries for a
 * non-object selection, and when `createSubscriber` actually opens the
 * ViewModel subscription.
 *
 * The port itself — tracked re-render, stale values, unmount, batching, the six
 * VM shapes and the rest — is proved once for every binding by
 * `lankaViewBindingConformance`, which `_playground/conformance.test.ts` already
 * runs for this package. Nothing here repeats it.
 */
import { describe, expect, it, vi } from "vitest";
import { flushSync } from "svelte";
import { createLankaVM } from "lanka/viewmodel";
import { useLankaVM } from "./useLankaVM";
import { runInLankaEffect } from "../../_playground/run-in-lanka-effect/runInLankaEffect.svelte";

interface ITestState {
	count: number;
	[key: string]: unknown;
}

interface ITestActions {
	bump: () => void;
	/** Writes a key that was never in `states` — the "arrives later" case. */
	addExtra: () => void;
}

const buildVM = () =>
	createLankaVM<ITestState, ITestActions>({
		name: "UseLankaVMSpecVM",
		states: { count: 0 },
		createActions: ({ set, get }) => ({
			bump: () => {
				set({ count: get().count + 1 });
			},
			addExtra: () => {
				set({ extra: "late" });
			},
		}),
	});

describe("the tracked view's shape", () => {
	it("answers one getter per state key, walkable by Object.keys, with `stop` absent from them", () => {
		// Svelte's compiler and `$inspect` read an object's OWN enumerable
		// descriptors — a Proxy would track correctly and show a consumer nothing
		// in devtools, which is why this shape is getters and not a Proxy, and why
		// `stop` is defined non-enumerable rather than a state key.
		const vm = buildVM();
		const view = useLankaVM(vm);

		expect(Object.keys(view)).toEqual(Object.keys(vm.getState()));
		expect(Object.prototype.propertyIsEnumerable.call(view, "stop")).toBe(false);
		expect(typeof view.stop).toBe("function");
	});

	it("takes its key set from `getState()` at CALL time, so a key that arrives later has no getter", () => {
		// Pinning the current behaviour, not endorsing it: a ViewModel whose schema
		// grows after this view was built leaves that key permanently unreadable
		// through it, because the getters were defined once, over the keys seen at
		// that moment, and nothing re-runs `Object.keys` afterwards.
		const vm = buildVM();
		const view = useLankaVM(vm);

		vm.getState().addExtra();

		expect(Object.keys(view)).not.toContain("extra");
		expect((view as Record<string, unknown>).extra).toBeUndefined();
	});
});

describe("the selected view's shape", () => {
	it("answers `current` for a selection that is not an object", () => {
		// `(state) => state.count` returning a number is the case that made this
		// shape necessary: a getter-per-key object has no keys to define on a
		// number, which is exactly what a narrower, object-only type would have
		// refused.
		const vm = buildVM();
		const view = useLankaVM(vm, (state) => state.count);

		expect(view.current).toBe(0);
		expect(typeof view.stop).toBe("function");
	});
});

describe("when the ViewModel subscription actually opens", () => {
	it("does not subscribe while the view is built but never read", () => {
		const vm = buildVM();
		const subscribe = vi.spyOn(vm, "subscribe");

		useLankaVM(vm);

		expect(subscribe).not.toHaveBeenCalled();
		subscribe.mockRestore();
	});

	it("subscribes on the first read, once one happens inside Svelte's reactive graph", () => {
		const vm = buildVM();
		const subscribe = vi.spyOn(vm, "subscribe");
		const view = useLankaVM(vm);

		const probe = runInLankaEffect(() => {
			void view.count;
		});

		expect(subscribe).toHaveBeenCalledTimes(1);

		probe.destroy();
		subscribe.mockRestore();
	});
});

describe("stop()", () => {
	it("releases the tracked view's subscription: no notification reaches the reader afterwards", () => {
		const vm = buildVM();
		const view = useLankaVM(vm);
		const probe = runInLankaEffect(() => {
			void view.count;
		});

		vm.getState().bump();
		flushSync();
		const afterFirstBump = probe.runs();

		// Sanity: the subscription was live, or the next half proves nothing.
		expect(afterFirstBump).toBeGreaterThan(1);

		view.stop();
		vm.getState().bump();
		flushSync();

		expect(probe.runs()).toBe(afterFirstBump);
		// A second stop must stay harmless.
		expect(() => {
			view.stop();
		}).not.toThrow();

		probe.destroy();
	});

	it("releases the selected view's subscription the same way", () => {
		// The selector arm is a second subscription path through the same
		// `createSubscriber`; a binding that released only the tracked one would
		// leak exactly half the time.
		const vm = buildVM();
		const view = useLankaVM(vm, (state) => state.count);
		const probe = runInLankaEffect(() => {
			void view.current;
		});

		vm.getState().bump();
		flushSync();
		const afterFirstBump = probe.runs();

		expect(afterFirstBump).toBeGreaterThan(1);

		view.stop();
		vm.getState().bump();
		flushSync();

		expect(probe.runs()).toBe(afterFirstBump);
		expect(() => {
			view.stop();
		}).not.toThrow();

		probe.destroy();
	});
});
