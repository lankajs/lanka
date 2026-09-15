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

	/** What the eager stateless factory answers: the READ half of the port only. */
	const statelessViewModelWith = (value: number) => {
		const resetScenario = vi.fn();

		return {
			name: "LazyStatelessVM",
			getState: vi.fn(() => ({ value, resetScenario })),
			subscribe: vi.fn(() => () => undefined),
			isAccessTracked: false,
			resetScenario,
		};
	};

	const lazyOver = (built: ReturnType<typeof statelessViewModelWith>) => {
		mockedCreateStatelessViewModel.mockReturnValue(built as never);

		return createLazyStatelessLankaVM({
			name: "LazyStatelessVM",
			createActions: () => ({ value: 0 }),
		});
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("builds nothing until something is read", () => {
		const lazy = lazyOver(statelessViewModelWith(1));

		expect(mockedCreateStatelessViewModel).not.toHaveBeenCalled();

		lazy.getState();

		expect(mockedCreateStatelessViewModel).toHaveBeenCalledOnce();
	});

	it("answers its name and its tracking flag without building", () => {
		const lazy = lazyOver(statelessViewModelWith(1));

		expect(lazy.name).toBe("LazyStatelessVM");
		expect(lazy.isAccessTracked).toBe(false);
		expect(mockedCreateStatelessViewModel).not.toHaveBeenCalled();
	});

	it("reports the same tracking answer as its eager twin", () => {
		// A stateless ViewModel has no reactive fields, so there is nothing whose
		// reads could be worth recording. A lazy one that said otherwise would make
		// a binding build a Proxy over an object that never moves.
		const lazy = lazyOver(statelessViewModelWith(1));

		expect(lazy.isAccessTracked).toBe(false);
	});

	it("builds once and reuses what it built", () => {
		const lazy = lazyOver(statelessViewModelWith(10));

		lazy.getState();
		lazy.getState();

		expect(mockedCreateStatelessViewModel).toHaveBeenCalledOnce();
	});

	it("forwards a read to the ViewModel it built", () => {
		const built = statelessViewModelWith(2);
		const lazy = lazyOver(built);

		expect(lazy.getState()).toMatchObject({ value: 2 });
		expect(built.getState).toHaveBeenCalled();
	});

	it("subscribes, and never hears anything — there is nothing to hear", () => {
		const built = statelessViewModelWith(2);
		const lazy = lazyOver(built);
		const listener = vi.fn();

		const unsubscribe = lazy.subscribe(listener);

		expect(built.subscribe).toHaveBeenCalledWith(listener);
		expect(listener).not.toHaveBeenCalled();
		expect(typeof unsubscribe).toBe("function");
	});

	it("releases what it built, and builds again after that", () => {
		const built = statelessViewModelWith(1);
		const lazy = lazyOver(built);

		lazy.getState();
		lazy.dispose();
		lazy.getState();

		expect(built.resetScenario).toHaveBeenCalledOnce();
		expect(mockedCreateStatelessViewModel).toHaveBeenCalledTimes(2);
	});

	it("is not mistaken for a promise", () => {
		const lazy = lazyOver(statelessViewModelWith(1));

		expect((lazy as unknown as { then?: unknown }).then).toBeUndefined();
		expect(mockedCreateStatelessViewModel).not.toHaveBeenCalled();
	});
});
