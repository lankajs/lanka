import { describe, expect, it } from "vitest";
import { defineComponent, h, isRef, nextTick } from "vue";
import { render } from "@testing-library/vue";
import { createLankaVM as createCoreLankaVM } from "lanka/viewmodel";
import { createLankaVM } from "./createLankaVM";

/**
 * The declaration site, in one line.
 *
 * What is under test is not the reading — `useLankaVM` and `toLankaCallableVM`
 * own that and are tested where they live. It is the promise these six names
 * make: core's factory, core's config, core's ViewModel, already wearing Vue's
 * read, so a consumer moves a declaration by changing the import line.
 */
interface ITodoState {
	todos: readonly string[];
	filter: string;
}

interface ITodoActions {
	add: (todo: string) => void;
}

const config = () => ({
	name: "TodoVM",
	states: { todos: [] as readonly string[], filter: "" },
	createActions: ({
		set,
		get,
	}: {
		set: (partial: Partial<ITodoState>) => void;
		get: () => ITodoState;
	}) => ({
		add: (todo: string) => set({ todos: [...get().todos, todo] }),
	}),
});

describe("createLankaVM (Vue)", () => {
	it("answers a ViewModel a component already reads with", async () => {
		const useTodoVM = createLankaVM<ITodoState, ITodoActions>(config());

		const Screen = defineComponent({
			setup() {
				const state = useTodoVM();

				return () =>
					h("button", { onClick: () => state.value.add("write") }, [
						String(state.value.todos.length),
					]);
			},
		});

		const { getByRole } = render(Screen);
		expect(getByRole("button").textContent).toBe("0");

		getByRole("button").click();
		await nextTick();

		expect(getByRole("button").textContent).toBe("1");
	});

	it("takes a selector, the second call shape `useLankaVM` already had", async () => {
		const useTodoVM = createLankaVM<ITodoState, ITodoActions>(config());

		const Screen = defineComponent({
			setup() {
				const count = useTodoVM((state) => state.todos.length);

				return () => h("p", String(count.value));
			},
		});

		const { getByText } = render(Screen);
		expect(getByText("0")).toBeDefined();

		useTodoVM.getState().add("write");
		await nextTick();

		expect(getByText("1")).toBeDefined();
	});

	it("answers a ref, because that is what Vue's read answers", () => {
		const useTodoVM = createLankaVM<ITodoState, ITodoActions>(config());
		const state = useTodoVM();

		// The one thing this shelf deliberately does not hide: a script reads
		// `.value`, a template does not. Flattening it here would make the six
		// factories mean something different from `useLankaVM` in the same package.
		expect(isRef(state)).toBe(true);
		expect(state.value.todos).toEqual([]);

		state.stop();
	});

	it("is the ViewModel too: its members answer outside a component", () => {
		const useTodoVM = createLankaVM<ITodoState, ITodoActions>(config());

		expect(useTodoVM.name).toBe("TodoVM");
		expect(useTodoVM.getState().todos).toEqual([]);
		expect(typeof useTodoVM.subscribe).toBe("function");
		expect("getState" in useTodoVM).toBe(true);
	});

	it("is one store, and the same store core's own factory builds", () => {
		const useTodoVM = createLankaVM<ITodoState, ITodoActions>(config());
		const seen: number[] = [];

		useTodoVM.subscribe((next) => seen.push(next.todos.length));
		useTodoVM.getState().add("write");

		expect(seen).toEqual([1]);
		expect(useTodoVM.getState().todos).toEqual(["write"]);

		// The framework-free declaration, for comparison: same config, same answer.
		const todoVM = createCoreLankaVM<ITodoState, ITodoActions>(config());

		todoVM.getState().add("write");
		expect(todoVM.getState().todos).toEqual(useTodoVM.getState().todos);
	});
});
