import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../logger/lanka-logger/LankaLogger", () => ({
	lankaLogger: {
		printViewModelLog: vi.fn(),
	},
}));

vi.mock("../create-stateless-lanka-vm/createStatelessLankaVM", () => ({
	createStatelessLankaVM: vi.fn(),
}));

import { createLazyStatelessLankaVM } from "./createLazyStatelessLankaVM";
import { createStatelessLankaVM } from "../create-stateless-lanka-vm/createStatelessLankaVM";

describe("createLazyStatelessLankaVM", () => {
	const mockedCreateStatelessViewModel = vi.mocked(createStatelessLankaVM);

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("does not create VM until first use", () => {
		const vmFn = vi.fn(() => ({
			value: 1,
		})) as unknown as ((selector?: (s: { value: number }) => unknown) => unknown) & {
			getState: () => { value: number };
		};
		vmFn.getState = vi.fn(() => ({ value: 1 }));

		mockedCreateStatelessViewModel.mockReturnValue(vmFn as never);

		const useLazy = createLazyStatelessLankaVM({
			name: "LazyStatelessVM",
			createActions: () => ({
				value: 1,
			}),
		});

		expect(mockedCreateStatelessViewModel).not.toHaveBeenCalled();

		const result = useLazy();

		expect(result).toEqual({ value: 1 });
		expect(mockedCreateStatelessViewModel).toHaveBeenCalledOnce();
	});

	it("reuses VM and forwards selector calls", () => {
		const state = { value: 10 };

		const vmFn = vi.fn((selector?: (s: typeof state) => unknown) =>
			selector ? selector(state) : state,
		) as unknown as ((selector?: (s: typeof state) => unknown) => unknown) & {
			getState: () => typeof state;
		};
		vmFn.getState = vi.fn(() => state);

		mockedCreateStatelessViewModel.mockReturnValue(vmFn as never);

		const useLazy = createLazyStatelessLankaVM({
			name: "LazyStatelessVM",
			createActions: () => ({
				value: 10,
			}),
		});

		const selected = useLazy((s) => s.value);
		const full = useLazy();

		expect(selected).toBe(10);
		expect(full).toBe(state);
		expect(mockedCreateStatelessViewModel).toHaveBeenCalledOnce();
		expect(vmFn).toHaveBeenCalledTimes(2);
	});

	it("getState creates VM and returns vm.getState result", () => {
		const vmFn = vi.fn(() => ({
			value: 2,
		})) as unknown as ((selector?: (s: { value: number }) => unknown) => unknown) & {
			getState: () => { value: number };
		};
		vmFn.getState = vi.fn(() => ({ value: 2 }));

		mockedCreateStatelessViewModel.mockReturnValue(vmFn as never);

		const useLazy = createLazyStatelessLankaVM({
			name: "LazyStatelessVM",
			createActions: () => ({
				value: 2,
			}),
		});

		const result = useLazy.getState();

		expect(result).toEqual({ value: 2 });
		expect(mockedCreateStatelessViewModel).toHaveBeenCalledOnce();
		expect(vmFn.getState).toHaveBeenCalledOnce();
	});

	it("retries VM creation if createStatelessLankaVM throws", () => {
		const vmFn = vi.fn(() => ({
			value: 3,
		})) as unknown as ((selector?: (s: { value: number }) => unknown) => unknown) & {
			getState: () => { value: number };
		};
		vmFn.getState = vi.fn(() => ({ value: 3 }));

		mockedCreateStatelessViewModel
			.mockImplementationOnce(() => {
				throw new Error("boom");
			})
			.mockReturnValueOnce(vmFn as never);

		const useLazy = createLazyStatelessLankaVM({
			name: "LazyStatelessVM",
			createActions: () => ({
				value: 3,
			}),
		});

		expect(() => useLazy()).toThrow("boom");
		expect(mockedCreateStatelessViewModel).toHaveBeenCalledTimes(1);

		const result = useLazy();

		expect(result).toEqual({ value: 3 });
		expect(mockedCreateStatelessViewModel).toHaveBeenCalledTimes(2);
	});

	it("stress: repeated lazy stateless getState access (timing)", () => {
		const state = { value: 7 };

		const vmFn = vi.fn((selector?: (s: typeof state) => unknown) =>
			selector ? selector(state) : state,
		) as unknown as ((selector?: (s: typeof state) => unknown) => unknown) & {
			getState: () => typeof state;
		};
		vmFn.getState = vi.fn(() => state);

		mockedCreateStatelessViewModel.mockReturnValue(vmFn as never);

		const useLazy = createLazyStatelessLankaVM({
			name: "LazyStatelessVM",
			createActions: () => ({
				value: 7,
			}),
		});

		const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

		const start = now();
		for (let i = 0; i < 1000; i += 1) {
			useLazy.getState();
		}
		const durationMs = now() - start;

		console.info(
			`createLazyStatelessLankaVM getState stress duration: ${durationMs.toFixed(2)}ms`,
		);

		expect(mockedCreateStatelessViewModel).toHaveBeenCalledOnce();
	});
});
