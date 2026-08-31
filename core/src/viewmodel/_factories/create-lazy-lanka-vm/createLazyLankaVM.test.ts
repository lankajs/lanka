import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../logger/lanka-logger/LankaLogger", () => ({
	lankaLogger: {
		printViewModelLog: vi.fn(),
	},
}));

vi.mock("../create-lanka-vm/createLankaVM", () => ({
	createLankaVM: vi.fn(),
}));

import { createLazyLankaVM } from "./createLazyLankaVM";
import { createLankaVM } from "../create-lanka-vm/createLankaVM";

describe("createLazyLankaVM", () => {
	const mockedCreateViewModel = vi.mocked(createLankaVM);

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("does not create store until first use", () => {
		const storeFn = vi.fn(() => ({
			value: 1,
		})) as unknown as ((selector?: (state: { value: number }) => unknown) => unknown) & {
			getState: () => { value: number };
		};
		storeFn.getState = vi.fn(() => ({ value: 1 }));
		mockedCreateViewModel.mockReturnValue(storeFn as never);

		const useLazy = createLazyLankaVM({
			name: "LazyVM",
			states: { value: 0 },
			createActions: () => ({}),
		});

		expect(mockedCreateViewModel).not.toHaveBeenCalled();

		const result = useLazy();

		expect(result).toEqual({ value: 1 });
		expect(mockedCreateViewModel).toHaveBeenCalledOnce();
	});

	it("reuses store and forwards selector calls", () => {
		const state = { value: 10 };
		const storeFn = vi.fn((selector?: (s: typeof state) => unknown) =>
			selector ? selector(state) : state,
		) as unknown as ((selector?: (s: typeof state) => unknown) => unknown) & {
			getState: () => typeof state;
		};
		storeFn.getState = vi.fn(() => state);
		mockedCreateViewModel.mockReturnValue(storeFn as never);

		const useLazy = createLazyLankaVM({
			name: "LazyVM",
			states: { value: 0 },
			createActions: () => ({}),
		});

		const selected = useLazy((s) => s.value);
		const full = useLazy();

		expect(selected).toBe(10);
		expect(full).toBe(state);
		expect(mockedCreateViewModel).toHaveBeenCalledOnce();
		expect(storeFn).toHaveBeenCalledTimes(2);
	});

	it("getState creates store and returns store.getState result", () => {
		const storeFn = vi.fn(() => ({
			value: 2,
		})) as unknown as ((selector?: (state: { value: number }) => unknown) => unknown) & {
			getState: () => { value: number };
		};
		storeFn.getState = vi.fn(() => ({ value: 2 }));
		mockedCreateViewModel.mockReturnValue(storeFn as never);

		const useLazy = createLazyLankaVM({
			name: "LazyVM",
			states: { value: 0 },
			createActions: () => ({}),
		});

		const result = useLazy.getState();

		expect(result).toEqual({ value: 2 });
		expect(mockedCreateViewModel).toHaveBeenCalledOnce();
		expect(storeFn.getState).toHaveBeenCalledOnce();
	});

	it("retries store creation if createLankaVM throws", () => {
		const storeFn = vi.fn(() => ({
			value: 3,
		})) as unknown as ((selector?: (state: { value: number }) => unknown) => unknown) & {
			getState: () => { value: number };
		};
		storeFn.getState = vi.fn(() => ({ value: 3 }));

		mockedCreateViewModel
			.mockImplementationOnce(() => {
				throw new Error("boom");
			})
			.mockReturnValueOnce(storeFn as never);

		const useLazy = createLazyLankaVM({
			name: "LazyVM",
			states: { value: 0 },
			createActions: () => ({}),
		});

		expect(() => useLazy()).toThrow("boom");
		expect(mockedCreateViewModel).toHaveBeenCalledTimes(1);

		const result = useLazy();

		expect(result).toEqual({ value: 3 });
		expect(mockedCreateViewModel).toHaveBeenCalledTimes(2);
	});
	it("stress: repeated lazy getState access (timing)", () => {
		const state = { value: 7 };
		const storeFn = vi.fn((selector?: (s: typeof state) => unknown) =>
			selector ? selector(state) : state,
		) as unknown as ((selector?: (s: typeof state) => unknown) => unknown) & {
			getState: () => typeof state;
		};
		storeFn.getState = vi.fn(() => state);
		mockedCreateViewModel.mockReturnValue(storeFn as never);

		const useLazy = createLazyLankaVM({
			name: "LazyVM",
			states: { value: 0 },
			createActions: () => ({}),
		});

		const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

		const start = now();
		for (let i = 0; i < 1000; i += 1) {
			useLazy.getState();
		}
		const durationMs = now() - start;

		console.info(`createLazyLankaVM getState stress duration: ${durationMs.toFixed(2)}ms`);
		expect(mockedCreateViewModel).toHaveBeenCalledOnce();
	});
});
