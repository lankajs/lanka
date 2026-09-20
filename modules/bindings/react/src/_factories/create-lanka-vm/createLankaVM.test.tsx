import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import { createLankaVM as createCoreLankaVM } from "lanka/viewmodel";
import { createLankaVM } from "./createLankaVM";
import type { JSX } from "react";

/**
 * The declaration site, in one line.
 *
 * What is under test is not the reading — `useLankaVM` and `toLankaReactVM` own
 * that and are tested where they live. It is the promise these six names make:
 * core's factory, core's config, core's ViewModel, already wearing React's
 * shape, so a consumer moves a declaration by changing the import line.
 */
afterEach(cleanup);

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

describe("createLankaVM (React)", () => {
	it("answers a ViewModel that is already callable", () => {
		const useTodoVM = createLankaVM<ITodoState, ITodoActions>(config());

		const Screen = (): JSX.Element => {
			const { todos, add } = useTodoVM();

			return (
				<button type="button" onClick={() => add("write")}>
					{todos.length}
				</button>
			);
		};

		render(<Screen />);
		expect(screen.getByRole("button").textContent).toBe("0");

		fireEvent.click(screen.getByRole("button"));
		expect(screen.getByRole("button").textContent).toBe("1");
	});

	it("takes a selector, the second call shape React already had", () => {
		const useTodoVM = createLankaVM<ITodoState, ITodoActions>(config());

		const Screen = (): JSX.Element => <p>{useTodoVM((state) => state.todos.length)}</p>;

		render(<Screen />);
		expect(screen.getByText("0")).toBeDefined();

		act(() => {
			useTodoVM.getState().add("write");
		});
		expect(screen.getByText("1")).toBeDefined();
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
