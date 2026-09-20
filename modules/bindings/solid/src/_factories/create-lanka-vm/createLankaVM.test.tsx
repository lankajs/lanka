import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@solidjs/testing-library";
import { createEffect } from "solid-js";
import { createLankaVM as createCoreLankaVM } from "lanka/viewmodel";
import { createLankaVM } from "./createLankaVM";

/**
 * The declaration site, in one line.
 *
 * What is under test is not the reading — `useLankaVM` and `toLankaCallableVM`
 * own that and are tested where they live. It is the promise these six names
 * make: core's factory, core's config, core's ViewModel, already wearing Solid's
 * read, so a consumer moves a declaration by changing the import line.
 */
afterEach(cleanup);

interface ITodoState {
	rows: readonly string[];
	filter: string;
}

interface ITodoActions {
	add: (row: string) => void;
	setFilter: (filter: string) => void;
}

const config = () => ({
	name: "TodoVM",
	states: { rows: [] as readonly string[], filter: "" },
	createActions: ({
		set,
		get,
	}: {
		set: (partial: Partial<ITodoState>) => void;
		get: () => ITodoState;
	}) => ({
		add: (row: string) => set({ rows: [...get().rows, row] }),
		setFilter: (filter: string) => set({ filter }),
	}),
});

describe("createLankaVM (Solid)", () => {
	it("answers a ViewModel that is already callable", () => {
		const useTodoVM = createLankaVM<ITodoState, ITodoActions>(config());

		const Screen = () => {
			const state = useTodoVM();

			return <p>{state().rows.length}</p>;
		};

		render(() => <Screen />);
		expect(screen.getByText("0")).toBeTruthy();

		useTodoVM.getState().add("write the canon");
		expect(screen.getByText("1")).toBeTruthy();
	});

	it("takes a selector, and the accessor moves only when the selection does", () => {
		const useTodoVM = createLankaVM<ITodoState, ITodoActions>(config());

		const Screen = () => {
			const count = useTodoVM((state) => state.rows.length);

			return <p>{count()}</p>;
		};

		render(() => <Screen />);
		expect(screen.getByText("0")).toBeTruthy();

		useTodoVM.getState().setFilter("done");
		expect(screen.getByText("0")).toBeTruthy();

		useTodoVM.getState().add("run the canon");
		expect(screen.getByText("1")).toBeTruthy();
	});

	it("is the ViewModel too: its members answer outside a component", () => {
		const useTodoVM = createLankaVM<ITodoState, ITodoActions>(config());

		expect(useTodoVM.name).toBe("TodoVM");
		expect(useTodoVM.getState().rows).toEqual([]);
		expect(typeof useTodoVM.subscribe).toBe("function");
		expect("getState" in useTodoVM).toBe(true);
	});

	it("is one store, and the same store core's own factory builds", () => {
		const useTodoVM = createLankaVM<ITodoState, ITodoActions>(config());
		const seen: number[] = [];

		useTodoVM.subscribe((next) => seen.push(next.rows.length));
		useTodoVM.getState().add("write the canon");

		expect(seen).toEqual([1]);
		expect(useTodoVM.getState().rows).toEqual(["write the canon"]);

		// The framework-free declaration, for comparison: same config, same answer.
		const todoVM = createCoreLankaVM<ITodoState, ITodoActions>(config());

		todoVM.getState().add("write the canon");
		expect(todoVM.getState().rows).toEqual(useTodoVM.getState().rows);
	});

	it("gives two components their OWN subscription, each tracking its own keys", () => {
		const useTodoVM = createLankaVM<ITodoState, ITodoActions>(config());
		const runs = { rows: 0, filter: 0 };

		const RowsScreen = () => {
			const state = useTodoVM();

			createEffect(() => {
				void state().rows;
				runs.rows += 1;
			});

			return <p>rows</p>;
		};

		const FilterScreen = () => {
			const state = useTodoVM();

			createEffect(() => {
				void state().filter;
				runs.filter += 1;
			});

			return <p>filter</p>;
		};

		render(() => (
			<>
				<RowsScreen />
				<FilterScreen />
			</>
		));

		expect(runs).toEqual({ rows: 1, filter: 1 });

		useTodoVM.getState().add("write the canon");

		// This is the defect the shape exists to avoid. A read applied at the
		// DECLARATION would be ONE subscription and one signal shared by both
		// components, so a change to `rows` would wake the filter screen too — and
		// the tracking that makes lanka skip work would have nothing to skip.
		expect(runs).toEqual({ rows: 2, filter: 1 });

		useTodoVM.getState().setFilter("done");

		expect(runs).toEqual({ rows: 2, filter: 2 });
	});
});
