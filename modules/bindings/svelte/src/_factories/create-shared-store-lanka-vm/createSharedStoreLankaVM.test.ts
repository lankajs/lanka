/**
 * One feature split across several ViewModels over a common store, declared one
 * line at a time.
 *
 * The thing worth asserting is that the wrapper did not multiply the store: two
 * ViewModels declared through this factory over one store must still answer one
 * state, and the member that shape adds — `getStoreState` — must survive.
 */
import { describe, expect, it } from "vitest";
import { flushSync } from "svelte";
import { createLankaSharedStore } from "lanka/viewmodel";
import type { ALankaSharedStore } from "lanka/viewmodel";
import { createSharedStoreLankaVM } from "./createSharedStoreLankaVM";
import { runInLankaEffect } from "../../../_playground/run-in-lanka-effect/runInLankaEffect.svelte";

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

describe("createSharedStoreLankaVM (Svelte)", () => {
	it("reads through this binding and keeps `getStoreState`", () => {
		const badgeVM = declare("BadgeVM", selectionStore());
		const view = badgeVM();
		const seen: (number | null)[] = [];

		const probe = runInLankaEffect(() => {
			seen.push(view.selectedId);
		});

		expect(seen).toEqual([null]);

		badgeVM.getState().select(7);
		flushSync();

		expect(seen).toEqual([null, 7]);
		expect(badgeVM.getStoreState()).toEqual({ selectedId: 7 });

		view.stop();
		probe.destroy();
	});

	it("two declarations over one store are still one store", () => {
		const store = selectionStore();
		const badgeVM = declare("BadgeVM", store);
		const listVM = declare("ListVM", store);

		badgeVM.getState().select(3);

		// A wrapper that copied state instead of forwarding would show two answers
		// here, and each component would be right about a different store.
		expect(listVM.getStoreState().selectedId).toBe(3);
		expect(listVM.getState().selectedId).toBe(3);
	});
});
