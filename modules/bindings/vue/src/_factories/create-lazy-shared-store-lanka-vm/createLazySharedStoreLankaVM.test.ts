import { describe, expect, it } from "vitest";
import { createLankaSharedStore } from "lanka/viewmodel";
import { createLazySharedStoreLankaVM } from "./createLazySharedStoreLankaVM";
import type { ALankaSharedStore } from "lanka/viewmodel";

/**
 * The shared-store factory's lazy half, declared in one line — and still lazy.
 *
 * Two members have to survive at once here, and they are the two a wrapper is
 * likeliest to drop: the laziness, and `getStoreState`.
 */
interface ISelection {
	selectedId: number | null;
}

interface IBadgeActions {
	select: (id: number) => void;
}

describe("createLazySharedStoreLankaVM (Vue)", () => {
	it("builds nothing at the declaration, then answers both shapes", () => {
		const built: string[] = [];
		const store: ALankaSharedStore<ISelection> = createLankaSharedStore<ISelection>(() => ({
			selectedId: null,
		}));
		const useBadgeVM = createLazySharedStoreLankaVM<
			ISelection,
			IBadgeActions,
			ALankaSharedStore<ISelection>
		>({
			name: "LazyBadgeVM",
			store,
			createActions: ({ set }) => {
				built.push("createActions");

				return { select: (id: number) => set({ selectedId: id }) };
			},
		});

		expect(built).toEqual([]);
		expect(useBadgeVM.name).toBe("LazyBadgeVM");
		expect(typeof useBadgeVM.dispose).toBe("function");
		expect(built).toEqual([]);

		useBadgeVM.getState().select(9);

		expect(built).toEqual(["createActions"]);
		expect(useBadgeVM.getStoreState().selectedId).toBe(9);
	});

	it("two lazy declarations over one store are still one store", () => {
		const store: ALankaSharedStore<ISelection> = createLankaSharedStore<ISelection>(() => ({
			selectedId: null,
		}));
		const declare = (name: string) =>
			createLazySharedStoreLankaVM<ISelection, IBadgeActions, ALankaSharedStore<ISelection>>({
				name,
				store,
				createActions: ({ set }) => ({ select: (id: number) => set({ selectedId: id }) }),
			});

		const useBadgeVM = declare("LazyBadgeVM");
		const useListVM = declare("LazyListVM");

		useBadgeVM.getState().select(4);

		expect(useListVM.getStoreState().selectedId).toBe(4);
		expect(useListVM.getState().selectedId).toBe(4);
	});
});
