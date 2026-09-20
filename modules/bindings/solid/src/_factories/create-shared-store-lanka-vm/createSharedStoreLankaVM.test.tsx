import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@solidjs/testing-library";
import { createLankaSharedStore } from "lanka/viewmodel";
import { createSharedStoreLankaVM } from "./createSharedStoreLankaVM";
import type { ALankaSharedStore } from "lanka/viewmodel";

/**
 * One feature split across several ViewModels over a common store, declared one
 * line at a time.
 *
 * The thing worth asserting is that the wrapper did not multiply the store: two
 * ViewModels declared through this factory over one store must still answer one
 * state, and the member that shape adds — `getStoreState` — must survive.
 */
afterEach(cleanup);

interface ISelection {
	selectedId: number | null;
}

interface IBadgeActions {
	select: (id: number) => void;
}

const selectionStore = () => createLankaSharedStore<ISelection>(() => ({ selectedId: null }));

const declare = (name: string, store: ALankaSharedStore<ISelection>) =>
	createSharedStoreLankaVM<ISelection, IBadgeActions, ALankaSharedStore<ISelection>>({
		name,
		store,
		createActions: ({ set }) => ({ select: (id: number) => set({ selectedId: id }) }),
	});

describe("createSharedStoreLankaVM (Solid)", () => {
	it("reads in a component and keeps `getStoreState`", () => {
		const useBadgeVM = declare("BadgeVM", selectionStore());

		const Screen = () => {
			const state = useBadgeVM();

			return <p>{String(state().selectedId)}</p>;
		};

		render(() => <Screen />);
		expect(screen.getByText("null")).toBeTruthy();

		useBadgeVM.getState().select(7);

		expect(screen.getByText("7")).toBeTruthy();
		expect(useBadgeVM.getStoreState()).toEqual({ selectedId: 7 });
	});

	it("two declarations over one store are still one store", () => {
		const store = selectionStore();
		const useBadgeVM = declare("BadgeVM", store);
		const useListVM = declare("ListVM", store);

		useBadgeVM.getState().select(3);

		// A wrapper that copied state instead of forwarding would show two answers
		// here, and each screen would be right about a different store.
		expect(useListVM.getStoreState().selectedId).toBe(3);
		expect(useListVM.getState().selectedId).toBe(3);
	});
});
