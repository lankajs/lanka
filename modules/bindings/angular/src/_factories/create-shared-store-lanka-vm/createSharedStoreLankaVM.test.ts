import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	createEnvironmentInjector,
	EnvironmentInjector,
	provideZonelessChangeDetection,
	runInInjectionContext,
} from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { resetActiveLanka, startLanka } from "lanka/bootstrap";
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
beforeEach(() => {
	resetActiveLanka();
	void startLanka({ host: lankaTestHost });
	TestBed.resetTestingModule();
	TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
});

afterEach(resetActiveLanka);

const scope = (): EnvironmentInjector =>
	createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));

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

describe("createSharedStoreLankaVM (Angular)", () => {
	it("is declared at module level with no injection context anywhere in sight", () => {
		const store = selectionStore();

		expect(() => declare("BadgeVM", store)).not.toThrow();
	});

	it("reads in an injection context and keeps `getStoreState`", () => {
		const badgeVM = declare("BadgeVM", selectionStore());

		const state = runInInjectionContext(scope(), () => badgeVM());

		expect(state().selectedId).toBeNull();

		badgeVM.getState().select(7);

		expect(state().selectedId).toBe(7);
		expect(badgeVM.getStoreState()).toEqual({ selectedId: 7 });
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
