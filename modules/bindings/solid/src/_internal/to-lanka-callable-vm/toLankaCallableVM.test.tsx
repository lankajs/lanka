import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@solidjs/testing-library";
import { createLankaVM } from "lanka/viewmodel";
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
