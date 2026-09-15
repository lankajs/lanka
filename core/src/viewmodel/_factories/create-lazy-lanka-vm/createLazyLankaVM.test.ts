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

	interface IValueState {
		value: number;
	}

	/**
	 * What the eager factory answers, as the lazy one sees it: a readable
	 * ViewModel and nothing else.
	 *
	 * The eager factory is mocked because this file is about the LAZY mechanism —
	 * build on first access, build once, release on dispose. A real ViewModel
	 * would bring a store, a scenario binder and bootstrap into a test about a
	 * Proxy.
	 */
	const viewModelWith = (value: number) => ({
		name: "LazyVM",
		getState: vi.fn(() => ({ value })),
		setState: vi.fn(),
		getInitialState: vi.fn(() => ({ value })),
		subscribe: vi.fn(() => () => undefined),
		isAccessTracked: true,
		resetScenario: vi.fn(),
	});

	const lazyOver = (built: ReturnType<typeof viewModelWith>) => {
		// `release` reaches `getState().resetScenario`, so the state a released
		// ViewModel answers has to carry one.
		built.getState.mockReturnValue({
			value: built.getInitialState().value,
			resetScenario: built.resetScenario,
		} as unknown as IValueState);
		mockedCreateViewModel.mockReturnValue(built as never);

		return createLazyLankaVM({
			name: "LazyVM",
			states: { value: 0 },
			createActions: () => ({}),
		});
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("builds nothing until something is read", () => {
		const lazy = lazyOver(viewModelWith(1));

		expect(mockedCreateViewModel).not.toHaveBeenCalled();

		lazy.getState();

		expect(mockedCreateViewModel).toHaveBeenCalledOnce();
	});

	it("answers its name without building anything", () => {
		// The property a binding, a devtool, a log line and a spread all read
		// first. Forwarding it as a call would have made every lazy ViewModel eager
		// the moment anything looked at it, which is the whole feature.
		const lazy = lazyOver(viewModelWith(1));

		expect(lazy.name).toBe("LazyVM");
		expect(mockedCreateViewModel).not.toHaveBeenCalled();
	});

	it("answers the tracking flag without building anything", () => {
		// `useLankaVM` reads this on its first render, before it subscribes.
		const lazy = lazyOver(viewModelWith(1));

		expect(lazy.isAccessTracked).toBe(true);
		expect(mockedCreateViewModel).not.toHaveBeenCalled();
	});

	it("builds once and reuses what it built", () => {
		const lazy = lazyOver(viewModelWith(10));

		lazy.getState();
		lazy.getState();
		lazy.subscribe(() => undefined);

		expect(mockedCreateViewModel).toHaveBeenCalledOnce();
	});

	it("forwards a read to the ViewModel it built", () => {
		const built = viewModelWith(2);
		const lazy = lazyOver(built);

		expect(lazy.getState()).toMatchObject({ value: 2 });
		expect(built.getState).toHaveBeenCalled();
	});

	it("forwards a subscription, and hands back the unsubscribe", () => {
		const built = viewModelWith(2);
		const lazy = lazyOver(built);
		const listener = vi.fn();

		const unsubscribe = lazy.subscribe(listener);

		expect(built.subscribe).toHaveBeenCalledWith(listener);
		expect(typeof unsubscribe).toBe("function");
	});

	it("tries again after a build that threw", () => {
		// A failed build must not poison the slot: the next access is a new attempt,
		// not a cached exception.
		const built = viewModelWith(3);
		built.getState.mockReturnValue({
			value: 3,
			resetScenario: built.resetScenario,
		} as unknown as IValueState);

		mockedCreateViewModel
			.mockImplementationOnce(() => {
				throw new Error("boom");
			})
			.mockReturnValueOnce(built as never);

		const lazy = createLazyLankaVM({
			name: "LazyVM",
			states: { value: 0 },
			createActions: () => ({}),
		});

		expect(() => lazy.getState()).toThrow("boom");
		expect(mockedCreateViewModel).toHaveBeenCalledTimes(1);

		expect(lazy.getState()).toMatchObject({ value: 3 });
		expect(mockedCreateViewModel).toHaveBeenCalledTimes(2);
	});

	it("is not mistaken for a promise", () => {
		// `await` and `Promise.resolve` decide by READING `.then`. A trap answering
		// a function for every name says yes for an object that is not a promise,
		// and the `await` then hangs forever with no error and no stack.
		const lazy = lazyOver(viewModelWith(1));

		expect((lazy as unknown as { then?: unknown }).then).toBeUndefined();
		expect((lazy as unknown as { catch?: unknown }).catch).toBeUndefined();
		expect((lazy as unknown as { finally?: unknown }).finally).toBeUndefined();
		expect(mockedCreateViewModel).not.toHaveBeenCalled();
	});

	it("releases what it built, and builds again after that", () => {
		const built = viewModelWith(1);
		const lazy = lazyOver(built);

		lazy.getState();
		lazy.dispose();
		lazy.getState();

		expect(built.resetScenario).toHaveBeenCalledOnce();
		expect(mockedCreateViewModel).toHaveBeenCalledTimes(2);
	});

	it("disposing one that never built does nothing at all", () => {
		// Building a ViewModel in order to destroy it is work with no result, and
		// it would resurrect one a closed screen had just released.
		const built = viewModelWith(1);
		const lazy = lazyOver(built);

		lazy.dispose();

		expect(mockedCreateViewModel).not.toHaveBeenCalled();
		expect(built.resetScenario).not.toHaveBeenCalled();
	});
});
