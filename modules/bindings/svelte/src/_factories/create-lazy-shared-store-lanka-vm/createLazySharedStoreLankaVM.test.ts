/**
 * The shared-store factory's lazy half, declared in one line — and still lazy.
 *
 * Two members have to survive at once here, and they are the two a wrapper is
 * likeliest to drop: the laziness, and `getStoreState`.
 */
import { describe, expect, it } from "vitest";
import { createLankaSharedStore } from "lanka/viewmodel";
import type { ALankaSharedStore } from "lanka/viewmodel";
import { createLazySharedStoreLankaVM } from "./createLazySharedStoreLankaVM";

interface ISelection {
	selectedId: number | null;
}

interface IBadgeActions {
	select: (id: number) => void;
}

const declare = (built: string[], store: ALankaSharedStore<ISelection>) =>
	createLazySharedStoreLankaVM<ISelection, IBadgeActions, ALankaSharedStore<ISelection>>({
		name: "LazyBadgeVM",
		store,
		createActions: ({ set }) => {
			built.push("createActions");

			return { select: (id: number) => set({ selectedId: id }) };
		},
	});

describe("createLazySharedStoreLankaVM (Svelte)", () => {
	it("builds nothing at the declaration, then answers both shapes", () => {
		const built: string[] = [];
		const store: ALankaSharedStore<ISelection> = createLankaSharedStore<ISelection>(() => ({
			selectedId: null,
		}));
		const badgeVM = declare(built, store);

		expect(built).toEqual([]);
		expect(badgeVM.name).toBe("LazyBadgeVM");
		expect(typeof badgeVM.dispose).toBe("function");
		expect(built).toEqual([]);

		badgeVM.getState().select(9);

		expect(built).toEqual(["createActions"]);
		expect(badgeVM.getStoreState().selectedId).toBe(9);

		const view = badgeVM();

		expect(view.selectedId).toBe(9);
		view.stop();
	});

	it("two lazy declarations over one store are still one store", () => {
		const built: string[] = [];
		const store: ALankaSharedStore<ISelection> = createLankaSharedStore<ISelection>(() => ({
			selectedId: null,
		}));
		const badgeVM = declare(built, store);
		const listVM = declare(built, store);

		badgeVM.getState().select(4);

		expect(listVM.getStoreState().selectedId).toBe(4);
		expect(listVM.getState().selectedId).toBe(4);
	});
});
