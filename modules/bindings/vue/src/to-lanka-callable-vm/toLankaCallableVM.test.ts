import { describe, expect, it } from "vitest";
import { defineComponent, h, nextTick } from "vue";
import { render } from "@testing-library/vue";
import { ALankaVM, createLankaVM, createLazyLankaVM } from "lanka/viewmodel";
import { toLankaCallableVM } from "./toLankaCallableVM";

/**
 * The one wrapper the six factories are built out of.
 *
 * What is under test is the FORWARDING, not the reading: `useLankaVM` owns the
 * subscription and is tested where it lives. Here the questions are the ones a
 * wrapper answers — that both call shapes survive being pre-applied, that the
 * ViewModel's own members still answer off the function, and that a lazy
 * ViewModel handed to it is still lazy afterwards.
 */
interface ICounterState {
	count: number;
}

interface ICounterActions {
	bump: () => void;
}

const counterConfig = (built: string[] = []) => ({
	name: "CallableCounterVM",
	states: { count: 0 },
	createActions: ({
		set,
		get,
	}: {
		set: (partial: Partial<ICounterState>) => void;
		get: () => ICounterState;
	}) => {
		built.push("createActions");

		return { bump: () => set({ count: get().count + 1 }) };
	},
});

/**
 * The class style of the same ViewModel.
 *
 * A class declares its own `name`, where the factory reads one off a config, and
 * nothing about the declaration mentions Vue — so the wrapper is the whole of
 * the step between `build()` and a component reading it.
 */
class ClassCounterVM extends ALankaVM<ICounterState, ICounterActions> {
	protected readonly name = "ClassCounterVM";

	protected override states(): ICounterState {
		return { count: 0 };
	}

	protected createActions(): ICounterActions {
		return { bump: () => this.set({ count: this.get().count + 1 }) };
	}
}

describe("toLankaCallableVM", () => {
	it("answers a ref a component reads, and updates it when the ViewModel moves", async () => {
		const useCounterVM = toLankaCallableVM(
			createLankaVM<ICounterState, ICounterActions>(counterConfig()),
		);

		const Screen = defineComponent({
			setup() {
				const state = useCounterVM();

				return () => h("p", String(state.value.count));
			},
		});

		const { getByText } = render(Screen);
		expect(getByText("0")).toBeDefined();

		useCounterVM.getState().bump();
		await nextTick();

		expect(getByText("1")).toBeDefined();
	});

	it("forwards a selector it was handed, rather than branching around the composable", async () => {
		const useCounterVM = toLankaCallableVM(
			createLankaVM<ICounterState, ICounterActions>(counterConfig()),
		);

		const Screen = defineComponent({
			setup() {
				// The second call shape, through the same single call site inside the
				// wrapper. A wrapper that dropped the argument would render "0" for
				// ever, because `doubled` would then be the whole state object.
				const doubled = useCounterVM((state) => state.count * 2);

				return () => h("p", String(doubled.value));
			},
		});

		const { getByText } = render(Screen);
		expect(getByText("0")).toBeDefined();

		useCounterVM.getState().bump();
		await nextTick();

		expect(getByText("2")).toBeDefined();
	});

	it("is the ViewModel too: its members answer outside a component", () => {
		const counterVM = createLankaVM<ICounterState, ICounterActions>(counterConfig());
		const useCounterVM = toLankaCallableVM(counterVM);

		expect(useCounterVM.name).toBe("CallableCounterVM");
		expect(useCounterVM.getState().count).toBe(0);
		expect(typeof useCounterVM.subscribe).toBe("function");
		expect("getState" in useCounterVM).toBe(true);

		// One store, not two: the wrapper is a Proxy over the ViewModel it was
		// given and adds nothing of its own.
		counterVM.getState().bump();
		expect(useCounterVM.getState().count).toBe(1);
	});

	it("leaves a lazy ViewModel lazy — reading its name builds nothing", () => {
		const built: string[] = [];
		const useCounterVM = toLankaCallableVM(
			createLazyLankaVM<ICounterState, ICounterActions>(counterConfig(built)),
		);

		expect(built).toEqual([]);
		expect(useCounterVM.name).toBe("CallableCounterVM");
		expect(built).toEqual([]);

		useCounterVM.getState().bump();
		expect(built).toEqual(["createActions"]);
	});
});

describe("toLankaCallableVM over a class-built ViewModel", () => {
	it("answers a ref a component reads, and updates it when an action runs", async () => {
		const useCounterVM = toLankaCallableVM(new ClassCounterVM().build());

		const Screen = defineComponent({
			setup() {
				const state = useCounterVM();

				return () => h("p", String(state.value.count));
			},
		});

		const { getByText } = render(Screen);
		expect(getByText("0")).toBeDefined();

		useCounterVM.getState().bump();
		await nextTick();

		expect(getByText("1")).toBeDefined();
	});

	it("keeps the name the CLASS declared, and the ViewModel's members with it", () => {
		const useCounterVM = toLankaCallableVM(new ClassCounterVM().build());

		// The class names itself where a config would have carried the name. A
		// wrapper that copied members instead of forwarding would answer the
		// function's own `name` here, which is the empty string.
		expect(useCounterVM.name).toBe("ClassCounterVM");
		expect(useCounterVM.getState().count).toBe(0);
		expect(typeof useCounterVM.subscribe).toBe("function");
		expect("getState" in useCounterVM).toBe(true);
	});

	it("is ONE store: a write through the ViewModel is what the component reads", async () => {
		const counterVM = new ClassCounterVM().build();
		const useCounterVM = toLankaCallableVM(counterVM);

		const Screen = defineComponent({
			setup() {
				const state = useCounterVM();

				return () => h("p", String(state.value.count));
			},
		});

		const { getByText } = render(Screen);

		counterVM.getState().bump();
		await nextTick();

		expect(getByText("1")).toBeDefined();
		expect(useCounterVM.getState().count).toBe(1);
	});
});
