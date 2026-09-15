import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../logger/lanka-logger/LankaLogger", () => ({
	lankaLogger: {
		printViewModelLog: vi.fn(),
	},
}));

vi.mock("../create-shared-store-lanka-vm/createSharedStoreLankaVM", () => ({
	createSharedStoreLankaVM: vi.fn(),
}));

import { createSharedStoreLankaVM } from "../create-shared-store-lanka-vm/createSharedStoreLankaVM";
import { createLazySharedStoreLankaVM } from "./createLazySharedStoreLankaVM";

describe("createLazySharedStoreLankaVM", () => {
	const mockedCreateSharedStoreViewModel = vi.mocked(createSharedStoreLankaVM);

	/**
	 * What the eager shared-store factory answers: the port, plus the one member
	 * this shape adds — the slice without the actions composed onto it.
	 */
	const sharedStoreViewModelWith = (value: number) => {
		const resetScenario = vi.fn();

		return {
			name: "LazySharedVM",
			getState: vi.fn(() => ({ value, resetScenario })),
			getStoreState: vi.fn(() => ({ value })),
			subscribe: vi.fn(() => () => undefined),
			isAccessTracked: true,
			resetScenario,
		};
	};

	const lazyOver = (built: ReturnType<typeof sharedStoreViewModelWith>) => {
		mockedCreateSharedStoreViewModel.mockReturnValue(built as never);

		return createLazySharedStoreLankaVM({
			name: "LazySharedVM",
			store: {} as never,
			createActions: () => ({}),
		});
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("builds nothing until something is read", () => {
		const lazy = lazyOver(sharedStoreViewModelWith(1));

		expect(mockedCreateSharedStoreViewModel).not.toHaveBeenCalled();

		lazy.getState();

		expect(mockedCreateSharedStoreViewModel).toHaveBeenCalledOnce();
	});

	it("answers its name and its tracking flag without building", () => {
		const lazy = lazyOver(sharedStoreViewModelWith(1));

		expect(lazy.name).toBe("LazySharedVM");
		expect(lazy.isAccessTracked).toBe(true);
		expect(mockedCreateSharedStoreViewModel).not.toHaveBeenCalled();
	});

	it("builds once and reuses what it built", () => {
		const lazy = lazyOver(sharedStoreViewModelWith(10));

		lazy.getState();
		lazy.getStoreState();

		expect(mockedCreateSharedStoreViewModel).toHaveBeenCalledOnce();
	});

	it("forwards the full read and the slice read separately", () => {
		// The distinction this shape exists for: a screen reads the composed state,
		// and whatever reasons about what is actually in the store reads the slice.
		const built = sharedStoreViewModelWith(2);
		const lazy = lazyOver(built);

		expect(lazy.getState()).toMatchObject({ value: 2 });
		expect(lazy.getStoreState()).toEqual({ value: 2 });
		expect(built.getState).toHaveBeenCalled();
		expect(built.getStoreState).toHaveBeenCalled();
	});

	it("forwards a subscription, and hands back the unsubscribe", () => {
		const built = sharedStoreViewModelWith(2);
		const lazy = lazyOver(built);
		const listener = vi.fn();

		const unsubscribe = lazy.subscribe(listener);

		expect(built.subscribe).toHaveBeenCalledWith(listener);
		expect(typeof unsubscribe).toBe("function");
	});

	it("releases what it built, and builds again after that", () => {
		const built = sharedStoreViewModelWith(1);
		const lazy = lazyOver(built);

		lazy.getState();
		lazy.dispose();
		lazy.getState();

		expect(built.resetScenario).toHaveBeenCalledOnce();
		expect(mockedCreateSharedStoreViewModel).toHaveBeenCalledTimes(2);
	});

	it("is not mistaken for a promise", () => {
		const lazy = lazyOver(sharedStoreViewModelWith(1));

		expect((lazy as unknown as { then?: unknown }).then).toBeUndefined();
		expect(mockedCreateSharedStoreViewModel).not.toHaveBeenCalled();
	});
});
