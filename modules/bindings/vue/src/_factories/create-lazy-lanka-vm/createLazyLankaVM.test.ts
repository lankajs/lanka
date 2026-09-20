import { describe, expect, it } from "vitest";
import { defineComponent, h } from "vue";
import { render } from "@testing-library/vue";
import { createLazyLankaVM } from "./createLazyLankaVM";

/**
 * The lazy declaration, in one line — and still lazy.
 *
 * The whole reason this factory exists is that a ViewModel a session may never
 * open costs nothing until it is opened. Wrapping it at the declaration site is
 * the obvious place to lose that: a wrapper that copied members instead of
 * forwarding would build the store to read them.
 */
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

describe("createLazyLankaVM (Vue)", () => {
	it("builds nothing at the declaration, and nothing to answer its name", () => {
		const { built, config } = spyingConfig();
		const useCounterVM = createLazyLankaVM<ICounterState, ICounterActions>(config);

		expect(built).toEqual([]);

		// Answered from the config by the lazy proxy, and forwarded by the Proxy
		// this factory wraps it in. Either one copying members would build here.
		expect(useCounterVM.name).toBe("LazyCounterVM");
		expect(built).toEqual([]);
	});

	it("builds on the first read, once, and reads as a composable afterwards", () => {
		const { built, config } = spyingConfig();
		const useCounterVM = createLazyLankaVM<ICounterState, ICounterActions>(config);

		useCounterVM.getState().bump();
		expect(built).toEqual(["createActions"]);
		expect(useCounterVM.getState().value).toBe(1);

		const Screen = defineComponent({
			setup() {
				const state = useCounterVM();

				return () => h("p", String(state.value.value));
			},
		});

		const { getByText } = render(Screen);
		expect(getByText("1")).toBeDefined();
		expect(built).toEqual(["createActions"]);
	});

	it("keeps `dispose`, which is the member the lazy shape adds", () => {
		const { config } = spyingConfig();
		const useCounterVM = createLazyLankaVM<ICounterState, ICounterActions>(config);

		expect(typeof useCounterVM.dispose).toBe("function");
	});
});
