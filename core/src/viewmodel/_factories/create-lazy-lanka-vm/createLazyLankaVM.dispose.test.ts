import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLazyLankaVM } from "./createLazyLankaVM";
import { createLanka } from "../../../bootstrap/_factories/create-lanka/createLanka";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";

/**
 * The lazy factory keeps both of its promises, not one.
 *
 * ## What this fixes
 *
 * 1. **An incomplete proxy.** Exposing only `getState` while the type promises
 *    the whole `UseBoundStore` makes the mismatch visible only at runtime:
 *    `setState` exists on the eager factory and is missing on the lazy one.
 * 2. **The store lived until the page reloaded.** For a ViewModel bound to a
 *    route that is a leak of exactly the size the lazy factory exists to save.
 */

describe("the lazy factory: a complete proxy", () => {
	beforeEach(() => {
		createLanka({ host: lankaTestHost });
	});

	it("exposes `setState`, `subscribe` and `getInitialState`, not only `getState`", () => {
		const useVM = createLazyLankaVM({
			name: "ProxyVM",
			states: { count: 0 },
			createActions: () => ({}),
		});

		expect(typeof useVM.getState).toBe("function");
		expect(typeof useVM.setState).toBe("function");
		expect(typeof useVM.subscribe).toBe("function");
		expect(typeof useVM.getInitialState).toBe("function");
	});

	it("`setState` really changes the state", () => {
		const useVM = createLazyLankaVM({
			name: "SetVM",
			states: { count: 0 },
			createActions: () => ({}),
		});

		useVM.setState({ count: 5 });

		expect(useVM.getState().count).toBe(5);
	});

	it("`subscribe` notifies of a change", () => {
		const useVM = createLazyLankaVM({
			name: "SubVM",
			states: { count: 0 },
			createActions: () => ({}),
		});
		const listener = vi.fn();

		useVM.subscribe(listener);
		useVM.setState({ count: 1 });

		expect(listener).toHaveBeenCalledTimes(1);
	});

	it("touching a method does NOT create the store early, except for those that need it", () => {
		const createActions = vi.fn(() => ({}));
		const useVM = createLazyLankaVM({
			name: "NoEagerVM",
			states: { count: 0 },
			createActions,
		});

		// The presence of methods does not create the store: otherwise "lazy" would
		// stop being lazy the moment someone looks at the object.
		expect(typeof useVM.setState).toBe("function");
		expect(createActions).not.toHaveBeenCalled();

		useVM.getState();
		expect(createActions).toHaveBeenCalledTimes(1);
	});
});

describe("the lazy factory: dispose", () => {
	beforeEach(() => {
		createLanka({ host: lankaTestHost });
	});

	it("after `dispose()` the next access creates the store again", () => {
		const useVM = createLazyLankaVM({
			name: "DisposeVM",
			states: { count: 0 },
			createActions: () => ({}),
		});

		useVM.setState({ count: 7 });
		expect(useVM.getState().count).toBe(7);

		useVM.dispose();

		// The initial state rather than the saved one: the store was destroyed, not
		// cleared.
		expect(useVM.getState().count).toBe(0);
	});

	it("`dispose()` removes scenario subscriptions", () => {
		const off = vi.fn();
		const scenario = {
			name: "DisposeScenario",
			eventType: "DISPOSE_EV",
			dataTypeName: "Data",
			subscribe: vi.fn(() => off),
			unsubscribe: vi.fn(),
			trigger: vi.fn(),
		};

		const useVM = createLazyLankaVM({
			name: "DisposeScenarioVM",
			states: { count: 0 },
			createActions: () => ({}),
			scenarioHandlers: [{ scenario, handler: () => () => undefined }],
		});

		useVM.getState().initializeScenario();
		useVM.dispose();

		expect(off).toHaveBeenCalledTimes(1);
	});

	it("`dispose()` on an uninitialised VM does not create a store just to destroy it", () => {
		const createActions = vi.fn(() => ({}));
		const useVM = createLazyLankaVM({
			name: "UntouchedVM",
			states: { count: 0 },
			createActions,
		});

		useVM.dispose();

		expect(createActions).not.toHaveBeenCalled();
	});

	it("calling `dispose()` twice is safe", () => {
		const useVM = createLazyLankaVM({
			name: "TwiceVM",
			states: { count: 0 },
			createActions: () => ({}),
		});

		useVM.getState();
		useVM.dispose();

		expect(() => useVM.dispose()).not.toThrow();
	});
});
