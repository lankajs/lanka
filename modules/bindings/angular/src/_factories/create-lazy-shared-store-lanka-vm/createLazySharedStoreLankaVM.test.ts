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
import { createLazySharedStoreLankaVM } from "./createLazySharedStoreLankaVM";
import type { ALankaSharedStore } from "lanka/viewmodel";

/**
 * The shared-store factory's lazy half, declared in one line — and still lazy.
 *
 * Two members have to survive at once here, and they are the two a wrapper is
 * likeliest to drop: the laziness, and `getStoreState`.
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

const selectionStore = (): ALankaSharedStore<ISelection> =>
	createLankaSharedStore<ISelection>(() => ({ selectedId: null }));

const spyingDeclaration = (name: string, store: ALankaSharedStore<ISelection>) => {
	const built: string[] = [];

	return {
		built,
		declare: () =>
			createLazySharedStoreLankaVM<ISelection, IBadgeActions, ALankaSharedStore<ISelection>>({
				name,
				store,
				createActions: ({ set }) => {
					built.push("createActions");

					return { select: (id: number) => set({ selectedId: id }) };
				},
			}),
	};
};

describe("createLazySharedStoreLankaVM (Angular)", () => {
	it("builds nothing at the declaration, and needs no injection context to be declared", () => {
		const { built, declare } = spyingDeclaration("LazyBadgeVM", selectionStore());

		expect(declare).not.toThrow();
		expect(built).toEqual([]);
	});

	it("answers its name without building, then both shapes once it is read", () => {
		const { built, declare } = spyingDeclaration("LazyBadgeVM", selectionStore());
		const badgeVM = declare();

		expect(badgeVM.name).toBe("LazyBadgeVM");
		expect(typeof badgeVM.dispose).toBe("function");
		expect(built).toEqual([]);

		badgeVM.getState().select(9);

		expect(built).toEqual(["createActions"]);
		expect(badgeVM.getStoreState().selectedId).toBe(9);
	});

	it("reads from inside an injection context, and two declarations are still one store", () => {
		const store = selectionStore();
		const badgeVM = spyingDeclaration("LazyBadgeVM", store).declare();
		const listVM = spyingDeclaration("LazyListVM", store).declare();

		const state = runInInjectionContext(scope(), () => badgeVM());

		expect(state().selectedId).toBeNull();

		listVM.getState().select(4);

		expect(state().selectedId).toBe(4);
		expect(badgeVM.getStoreState().selectedId).toBe(4);
	});
});
