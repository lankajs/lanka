import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@solidjs/testing-library";
import { ALankaVM, createLankaVM } from "lanka/viewmodel";
import { toLankaCallableVM } from "./toLankaCallableVM";

/**
 * The one wrapper the six factories are built out of.
 *
 * What is under test is not the reading — `useLankaVM` owns that and is tested
 * where it lives. It is the two halves this file adds: that the ViewModel's
 * members survive the call signature, and that nothing at all happens until the
 * call, which is the whole reason the pre-applied read is `useLankaVM` and not
 * `toLankaSolidVM`.
 */
afterEach(cleanup);

interface ITodoState {
	rows: readonly string[];
	filter: string;
}

interface ITodoActions {
	add: (row: string) => void;
}

const createTodoVM = () =>
	createLankaVM<ITodoState, ITodoActions>({
		name: "CallableTodoVM",
		states: { rows: [] as readonly string[], filter: "" },
		createActions: ({ set, get }) => ({
			add: (row: string) => {
				set({ rows: [...get().rows, row] });
			},
		}),
	});

/**
 * The class style of the same ViewModel.
 *
 * A class declares its own `name`, where the factory reads one off a config, and
 * nothing about the declaration mentions Solid — so the wrapper is the whole of
 * the step between `build()` and a component reading it.
 */
class ClassTodoVM extends ALankaVM<ITodoState, ITodoActions> {
	protected readonly name = "ClassTodoVM";

	protected override states(): ITodoState {
		return { rows: [] as readonly string[], filter: "" };
	}

	protected createActions(): ITodoActions {
		return { add: (row) => this.set({ rows: [...this.get().rows, row] }) };
	}
}

describe("toLankaCallableVM", () => {
	it("answers an accessor when called inside a component", () => {
		const useTodoVM = toLankaCallableVM(createTodoVM());

		const Screen = () => {
			const state = useTodoVM();

			return <p>{state().rows.length}</p>;
		};

		render(() => <Screen />);
		expect(screen.getByText("0")).toBeTruthy();

		useTodoVM.getState().add("write the canon");
		expect(screen.getByText("1")).toBeTruthy();
	});

	it("takes a selector, and answers an accessor over what it picked", () => {
		const useTodoVM = toLankaCallableVM(createTodoVM());

		const Screen = () => {
			const count = useTodoVM((state) => state.rows.length);

			return <p>{count()}</p>;
		};

		render(() => <Screen />);
		expect(screen.getByText("0")).toBeTruthy();

		useTodoVM.getState().add("run the canon");
		expect(screen.getByText("1")).toBeTruthy();
	});

	it("is the ViewModel too: its members answer with no owner at all", () => {
		const useTodoVM = toLankaCallableVM(createTodoVM());

		expect(useTodoVM.name).toBe("CallableTodoVM");
		expect(useTodoVM.getState().rows).toEqual([]);
		expect(typeof useTodoVM.subscribe).toBe("function");
		expect("getState" in useTodoVM).toBe(true);
	});

	it("opens nothing at the declaration, where there is no owner to release it", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const viewModel = createTodoVM();
		const subscribe = vi.spyOn(viewModel, "subscribe");

		// The declaration site, exactly as a consumer writes it: module level, no
		// component, no root. `toLankaSolidVM` applied here would call `createSignal`
		// and `onCleanup` — one subscription with nobody to stop it, shared by every
		// component that later read it, and Solid warning about the owner it lacks.
		const useTodoVM = toLankaCallableVM(viewModel);

		expect(subscribe).not.toHaveBeenCalled();
		expect(warn).not.toHaveBeenCalled();

		// Reading a member is not a read of the STATE either, and still subscribes
		// to nothing.
		expect(useTodoVM.name).toBe("CallableTodoVM");
		expect(subscribe).not.toHaveBeenCalled();

		subscribe.mockRestore();
		warn.mockRestore();
	});
});

describe("toLankaCallableVM over a class-built ViewModel", () => {
	it("answers an accessor a component reads, and an action moves what it shows", () => {
		const useTodoVM = toLankaCallableVM(new ClassTodoVM().build());

		const Screen = () => {
			const state = useTodoVM();

			return <p>{state().rows.length}</p>;
		};

		render(() => <Screen />);
		expect(screen.getByText("0")).toBeTruthy();

		useTodoVM.getState().add("write the canon");
		expect(screen.getByText("1")).toBeTruthy();
	});

	it("keeps the name the CLASS declared, and the ViewModel's members with it", () => {
		const useTodoVM = toLankaCallableVM(new ClassTodoVM().build());

		// The class names itself where a config would have carried the name, and
		// the members answer with no owner at all — a wrapper that copied instead
		// of forwarding would answer the function's own `name`, the empty string.
		expect(useTodoVM.name).toBe("ClassTodoVM");
		expect(useTodoVM.getState().rows).toEqual([]);
		expect(typeof useTodoVM.subscribe).toBe("function");
		expect("getState" in useTodoVM).toBe(true);
	});

	it("is ONE store: a write through the ViewModel is what the component reads", () => {
		const todoVM = new ClassTodoVM().build();
		const useTodoVM = toLankaCallableVM(todoVM);

		const Screen = () => {
			const state = useTodoVM();

			return <p>{state().rows.length}</p>;
		};

		render(() => <Screen />);

		todoVM.getState().add("run the canon");

		expect(screen.getByText("1")).toBeTruthy();
		expect(useTodoVM.getState().rows).toEqual(["run the canon"]);
	});
});
