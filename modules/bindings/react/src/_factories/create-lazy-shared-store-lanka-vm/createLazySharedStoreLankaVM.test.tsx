import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createLankaSharedStore } from "lanka/viewmodel";
import type { ALankaSharedStore } from "lanka/viewmodel";
import { createLazySharedStoreLankaVM } from "./createLazySharedStoreLankaVM";

/**
 * The shared-store factory's lazy half, declared in one line — and still lazy.
 *
 * Two members have to survive at once here, and they are the two a wrapper is
 * likeliest to drop: the laziness, and `getStoreState`.
 */
afterEach(cleanup);

interface ISelection {
	selectedId: number | null;
}

interface IBadgeActions {
	select: (id: number) => void;
}

describe("createLazySharedStoreLankaVM (React)", () => {
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
});
