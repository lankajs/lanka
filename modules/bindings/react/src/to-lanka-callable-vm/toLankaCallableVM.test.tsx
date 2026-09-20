import { act, cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import { ALankaVM, createLankaVM } from "lanka/viewmodel";
import { toLankaCallableVM } from "./toLankaCallableVM";
import { toLankaReactVM } from "../to-lanka-react-vm/toLankaReactVM";
import type { JSX } from "react";

/**
 * The shelf's name for what this package already did, and the step the class
 * style was missing.
 *
 * The six factories answer a callable for a ViewModel declared THROUGH them. A
 * class declares itself, so until this was published under a name every member
 * answers to, `createLankaVM(config)` was one line and a class was two.
 */
afterEach(cleanup);

interface ITodoState {
	todos: readonly string[];
}

interface ITodoActions {
	add: (todo: string) => void;
}

class TodoVM extends ALankaVM<ITodoState, ITodoActions> {
	protected readonly name = "ClassTodoVM";

	protected override states(): ITodoState {
		return { todos: [] };
	}

	protected createActions(): ITodoActions {
		return { add: (todo) => this.set({ todos: [...this.get().todos, todo] }) };
	}
}

describe("toLankaCallableVM (React)", () => {
	it("makes a CLASS-built ViewModel readable in one expression", () => {
		const useTodoVM = toLankaCallableVM(new TodoVM().build());

		const Screen = (): JSX.Element => <p>{useTodoVM().todos.length}</p>;

		render(<Screen />);
		expect(screen.getByText("0")).toBeDefined();

		act(() => {
			useTodoVM.getState().add("write");
		});
		expect(screen.getByText("1")).toBeDefined();
	});

	it("is the ViewModel too, exactly as a declared one is", () => {
		const useTodoVM = toLankaCallableVM(new TodoVM().build());

		// The class names itself, and the name must survive the wrapper the same
		// way a config's does — this is the half of parity that was missing.
		expect(useTodoVM.name).toBe("ClassTodoVM");
		expect(typeof useTodoVM.subscribe).toBe("function");
		expect("getState" in useTodoVM).toBe(true);
	});

	it("takes a selector, and a ViewModel core built", () => {
		const todoVM = createLankaVM<ITodoState, ITodoActions>({
			name: "FactoryTodoVM",
			states: { todos: [] },
			createActions: ({ set, get }) => ({
				add: (todo: string) => set({ todos: [...get().todos, todo] }),
			}),
		});
		const useTodoVM = toLankaCallableVM(todoVM);

		const Screen = (): JSX.Element => <p>{useTodoVM((state) => state.todos.length)}</p>;

		render(<Screen />);
		expect(screen.getByText("0")).toBeDefined();
	});

	it("is the same function `toLankaReactVM` is, under the shelf's name", () => {
		const viewModel = new TodoVM().build();

		// Not "behaves the same": the older spelling stays published and stays
		// exactly this, so a codebase mixing the two names mixes nothing else.
		expect(toLankaCallableVM(viewModel).getState()).toBe(toLankaReactVM(viewModel).getState());
	});
});
