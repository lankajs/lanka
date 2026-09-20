/**
 * The lazy declaration, in one line — and still lazy.
 *
 * The whole reason this factory exists is that a ViewModel a session may never
 * open costs nothing until it is opened. Wrapping it at the declaration site is
 * the obvious place to lose that: a wrapper that copied members instead of
 * forwarding would build the store to read them.
 */
import { describe, expect, it } from "vitest";
import { flushSync } from "svelte";
import { createLazyLankaVM } from "./createLazyLankaVM";
import { runInLankaEffect } from "../../../_playground/run-in-lanka-effect/runInLankaEffect.svelte";

interface ICounterState {
	value: number;
}

interface ICounterActions {
	bump: () => void;
}

const spyingConfig = () => {
	const built: string[] = [];

	return {
		built,
		config: {
			name: "LazyCounterVM",
			states: { value: 0 },
			createActions: ({
				set,
				get,
			}: {
				set: (partial: Partial<ICounterState>) => void;
				get: () => ICounterState;
			}) => {
				built.push("createActions");

				return { bump: () => set({ value: get().value + 1 }) };
			},
		},
	};
};

describe("createLazyLankaVM (Svelte)", () => {
	it("builds nothing at the declaration, and nothing to answer its name", () => {
		const { built, config } = spyingConfig();
		const counterVM = createLazyLankaVM<ICounterState, ICounterActions>(config);

		expect(built).toEqual([]);

		// Answered from the config by the lazy proxy, and forwarded by the Proxy
		// this factory wraps it in. Either one copying members would build here.
		expect(counterVM.name).toBe("LazyCounterVM");
		expect(built).toEqual([]);
	});

	it("builds on the first read, once, and reads through this binding afterwards", () => {
		const { built, config } = spyingConfig();
		const counterVM = createLazyLankaVM<ICounterState, ICounterActions>(config);

		counterVM.getState().bump();
		expect(built).toEqual(["createActions"]);
		expect(counterVM.getState().value).toBe(1);

		const view = counterVM();
		const seen: number[] = [];
		const probe = runInLankaEffect(() => {
			seen.push(view.value);
		});

		expect(seen).toEqual([1]);

		counterVM.getState().bump();
		flushSync();

		expect(seen).toEqual([1, 2]);
		expect(built).toEqual(["createActions"]);

		view.stop();
		probe.destroy();
	});

	it("keeps `dispose`, which is the member the lazy shape adds", () => {
		const { config } = spyingConfig();
		const counterVM = createLazyLankaVM<ICounterState, ICounterActions>(config);

		expect(typeof counterVM.dispose).toBe("function");
	});
});
