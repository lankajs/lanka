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

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("does not create VM until first use", () => {
		const vmFn = vi.fn(() => ({
			value: 1,
		})) as unknown as ((selector?: (state: { value: number }) => unknown) => unknown) & {
			getState: () => { value: number };
			getStoreState: () => { value: number };
		};
		vmFn.getState = vi.fn(() => ({ value: 1 }));
		vmFn.getStoreState = vi.fn(() => ({ value: 1 }));
		mockedCreateSharedStoreViewModel.mockReturnValue(vmFn as never);

		const useLazy = createLazySharedStoreLankaVM({
			name: "LazySharedVM",
			store: {} as never,
			createActions: () => ({}),
		});

		expect(mockedCreateSharedStoreViewModel).not.toHaveBeenCalled();

		const result = useLazy();

		expect(result).toEqual({ value: 1 });
		expect(mockedCreateSharedStoreViewModel).toHaveBeenCalledOnce();
	});

	it("reuses VM and forwards selector calls", () => {
		const state = { value: 10 };
		const vmFn = vi.fn((selector?: (s: typeof state) => unknown) =>
			selector ? selector(state) : state,
		) as unknown as ((selector?: (s: typeof state) => unknown) => unknown) & {
			getState: () => typeof state;
			getStoreState: () => typeof state;
		};
		vmFn.getState = vi.fn(() => state);
		vmFn.getStoreState = vi.fn(() => state);
		mockedCreateSharedStoreViewModel.mockReturnValue(vmFn as never);

		const useLazy = createLazySharedStoreLankaVM({
			name: "LazySharedVM",
			store: {} as never,
			createActions: () => ({}),
		});

		const selected = useLazy((s) => (s as unknown as { value: number }).value);
		const full = useLazy();

		expect(selected).toBe(10);
		expect(full).toBe(state);
		expect(mockedCreateSharedStoreViewModel).toHaveBeenCalledOnce();
		expect(vmFn).toHaveBeenCalledTimes(2);
	});

	it("getState creates VM and returns vm.getState result", () => {
		const vmFn = vi.fn(() => ({
			value: 2,
		})) as unknown as ((selector?: (state: { value: number }) => unknown) => unknown) & {
			getState: () => { value: number };
			getStoreState: () => { value: number };
		};
		vmFn.getState = vi.fn(() => ({ value: 2 }));
		vmFn.getStoreState = vi.fn(() => ({ value: 2 }));
		mockedCreateSharedStoreViewModel.mockReturnValue(vmFn as never);

		const useLazy = createLazySharedStoreLankaVM({
			name: "LazySharedVM",
			store: {} as never,
			createActions: () => ({}),
		});

		const result = useLazy.getState();

		expect(result).toEqual({ value: 2 });
		expect(mockedCreateSharedStoreViewModel).toHaveBeenCalledOnce();
		expect(vmFn.getState).toHaveBeenCalledOnce();
	});

	it("getStoreState creates VM and returns vm.getStoreState result", () => {
		const vmFn = vi.fn(() => ({
			value: 3,
		})) as unknown as ((selector?: (state: { value: number }) => unknown) => unknown) & {
			getState: () => { value: number };
			getStoreState: () => { value: number };
		};
		vmFn.getState = vi.fn(() => ({ value: 3 }));
		vmFn.getStoreState = vi.fn(() => ({ value: 3 }));
		mockedCreateSharedStoreViewModel.mockReturnValue(vmFn as never);

		const useLazy = createLazySharedStoreLankaVM({
			name: "LazySharedVM",
			store: {} as never,
			createActions: () => ({}),
		});

		const result = useLazy.getStoreState();

		expect(result).toEqual({ value: 3 });
		expect(mockedCreateSharedStoreViewModel).toHaveBeenCalledOnce();
		expect(vmFn.getStoreState).toHaveBeenCalledOnce();
	});

	it("retries VM creation if createSharedStoreLankaVM throws", () => {
		const vmFn = vi.fn(() => ({
			value: 4,
		})) as unknown as ((selector?: (state: { value: number }) => unknown) => unknown) & {
			getState: () => { value: number };
			getStoreState: () => { value: number };
		};
		vmFn.getState = vi.fn(() => ({ value: 4 }));
		vmFn.getStoreState = vi.fn(() => ({ value: 4 }));

		mockedCreateSharedStoreViewModel
			.mockImplementationOnce(() => {
				throw new Error("boom");
			})
			.mockReturnValueOnce(vmFn as never);

		const useLazy = createLazySharedStoreLankaVM({
			name: "LazySharedVM",
			store: {} as never,
			createActions: () => ({}),
		});

		expect(() => useLazy()).toThrow("boom");
		expect(mockedCreateSharedStoreViewModel).toHaveBeenCalledTimes(1);

		const result = useLazy();

		expect(result).toEqual({ value: 4 });
		expect(mockedCreateSharedStoreViewModel).toHaveBeenCalledTimes(2);
	});

	it("stress: repeated lazy shared vm getState access (timing)", () => {
		const state = { value: 7 };
		const vmFn = vi.fn((selector?: (s: typeof state) => unknown) =>
			selector ? selector(state) : state,
		) as unknown as ((selector?: (s: typeof state) => unknown) => unknown) & {
			getState: () => typeof state;
			getStoreState: () => typeof state;
		};
		vmFn.getState = vi.fn(() => state);
		vmFn.getStoreState = vi.fn(() => state);
		mockedCreateSharedStoreViewModel.mockReturnValue(vmFn as never);

		const useLazy = createLazySharedStoreLankaVM({
			name: "LazySharedVM",
			store: {} as never,
			createActions: () => ({}),
		});

		const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

		const start = now();
		for (let i = 0; i < 1000; i += 1) {
			useLazy.getState();
		}
		const durationMs = now() - start;

		console.info(
			`createLazySharedStoreLankaVM getState stress duration: ${durationMs.toFixed(2)}ms`,
		);

		expect(mockedCreateSharedStoreViewModel).toHaveBeenCalledOnce();
	});
});
