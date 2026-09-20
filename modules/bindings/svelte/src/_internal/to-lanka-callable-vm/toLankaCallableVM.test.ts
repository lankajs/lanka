/**
 * The one piece the six factories in `_factories/` share: a ViewModel that is
 * also this package's read.
 *
 * What is under test is the FORWARDING, not the reading — `useLankaVM` owns
 * that and is tested where it lives. Here: that the call reaches the reader with
 * the selector as it arrived, that the ViewModel's own members still answer
 * through the callable, and that nothing is copied, because a copy would build a
 * lazy ViewModel at the moment it was wrapped.
 */
import { describe, expect, it, vi } from "vitest";
import { createLankaVM, createLazyLankaVM } from "lanka/viewmodel";
import { toLankaCallableVM } from "./toLankaCallableVM";

interface ICounterState {
	count: number;
}

interface ICounterActions {
	bump: () => void;
}

const config = (onBuild?: () => void) => ({
	name: "CallableSpecVM",
	states: { count: 0 },
	createActions: ({
		set,
		get,
	}: {
		set: (partial: Partial<ICounterState>) => void;
		get: () => ICounterState;
	}) => {
		onBuild?.();

		return { bump: () => set({ count: get().count + 1 }) };
	},
});

describe("toLankaCallableVM", () => {
	it("calls the reader once, with the selector exactly as it arrived", () => {
		const viewModel = createLankaVM<ICounterState, ICounterActions>(config());
		const subscribe = vi.spyOn(viewModel, "subscribe");
		const callable = toLankaCallableVM(viewModel);

		// No selector: the tracked shape, which is one getter per key of the
		// ViewModel's full state — the reactive fields, the actions and the
		// scenario members alike.
		const view = callable();

		expect(Object.keys(view)).toEqual(Object.keys(viewModel.getState()));
		expect(view.count).toBe(0);

		// A selector: one value under `current`, and NOT the state's keys. A
		// wrapper that branched would be two call sites where the consumer wrote
		// one, and each would open its own view over the same ViewModel.
		const selected = callable((state) => state.count);

		expect(selected.current).toBe(0);
		expect(Object.keys(selected)).toEqual(["current"]);

		// Neither read happened inside an effect, so no subscription opened —
		// `createSubscriber` is what decides that, and the wrapper adds nothing.
		expect(subscribe).not.toHaveBeenCalled();
		subscribe.mockRestore();
	});

	it("is the ViewModel too: its members answer through the callable", () => {
		const viewModel = createLankaVM<ICounterState, ICounterActions>(config());
		const callable = toLankaCallableVM(viewModel);

		expect(callable.name).toBe("CallableSpecVM");
		expect(callable.getState().count).toBe(0);
		expect(typeof callable.subscribe).toBe("function");

		// `in` has to answer for the ViewModel as well, which is how a devtool and
		// a duck-typed helper ask.
		expect("getState" in callable).toBe(true);

		callable.getState().bump();
		expect(callable.getState().count).toBe(1);
		expect(viewModel.getState().count).toBe(1);
	});

	it("forwards rather than copies, so a lazy ViewModel stays unbuilt", () => {
		const built: string[] = [];
		const viewModel = createLazyLankaVM<ICounterState, ICounterActions>(
			config(() => built.push("createActions")),
		);
		const callable = toLankaCallableVM(viewModel);

		expect(built).toEqual([]);

		// Answered from the config by the lazy proxy, and forwarded by the Proxy
		// this wrapper builds. Either one copying members would build here.
		expect(callable.name).toBe("CallableSpecVM");
		expect(built).toEqual([]);

		callable.getState().bump();
		expect(built).toEqual(["createActions"]);
	});
});
