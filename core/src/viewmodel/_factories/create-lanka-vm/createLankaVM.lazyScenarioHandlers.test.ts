/**
 * `scenarioHandlers` as a FACTORY: built at bind time, not at declaration time.
 *
 * ## The failure this exists to catch
 *
 * A binding entry names its scenario, and an application names one through the
 * locator — `lankaScenarios.<name>`. Written as an array literal in a module
 * body, that lookup happens while the module is being EVALUATED, and a module
 * body can run before `createLanka` has: the locator then refuses with "lanka
 * used before an instance existed" and nothing renders.
 *
 * Import order is not a defence. It holds inside one chunk, and a bundler decides
 * chunks — the body of an imported chunk runs before the body of the chunk
 * importing it. Measured in a real application: 44 of its chunks were statically
 * imported by the entry, its ViewModels among them, so they were evaluated ahead
 * of its own `createLanka` call and the whole browser-level suite died on the
 * first one. Every unit test passed throughout, because a test runner evaluates
 * modules one at a time and never builds a chunk graph.
 *
 * `gateways` and `services` had accepted a factory for this exact reason since
 * `resolveLankaDependency` was written; bindings were the field left out, and
 * they are the field that reads the locator most.
 *
 * The array form is unchanged and still eager — that is what the last case here
 * pins, because a fix that quietly made every ViewModel lazy would change when
 * subscriptions happen for every consumer that never had this problem.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../logger/lanka-logger/LankaLogger", () => ({
	lankaLogger: {
		printViewModelLog: vi.fn(),
	},
}));

import { createLankaVM } from "./createLankaVM";
import { lankaScenarioBootstrap } from "../../../scenario/lanka-scenario-bootstrap/LankaScenarioBootstrap";

const createScenarioDouble = () => ({
	name: "LazyScenario",
	eventType: "LAZY_EV",
	dataTypeName: "LazyData",
	subscribe: vi.fn(() => () => undefined),
	unsubscribe: vi.fn(() => () => undefined),
	trigger: vi.fn(),
});

describe("createLankaVM — scenarioHandlers declared as a factory", () => {
	const registerViewModelMock = vi.spyOn(lankaScenarioBootstrap, "registerViewModel");

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("does not read the bindings while the ViewModel is being declared", () => {
		const readBindings = vi.fn(() => []);

		createLankaVM({
			name: "LazyVM",
			createActions: () => ({}),
			scenarioHandlers: readBindings,
		});

		// The whole point: in an application this call is `lankaScenarios.<name>`,
		// and this line is the module body of the file declaring the ViewModel.
		expect(readBindings).not.toHaveBeenCalled();
	});

	it("reads them once the scenarios are initialized, and subscribes them", () => {
		const scenario = createScenarioDouble();
		const readBindings = vi.fn(() => [{ scenario, handler: () => () => undefined }]);

		const store = createLankaVM({
			name: "LazyVM",
			createActions: () => ({}),
			scenarioHandlers: readBindings,
		});

		expect(readBindings).not.toHaveBeenCalled();
		expect(scenario.subscribe).not.toHaveBeenCalled();

		(store.getState() as unknown as { initializeScenario: () => void }).initializeScenario();

		expect(readBindings).toHaveBeenCalledTimes(1);
		expect(scenario.subscribe).toHaveBeenCalledTimes(1);
	});

	it("registers a ViewModel whose handlers are a factory", () => {
		// Registration cannot ask how MANY there are without calling the factory,
		// which would be the read this form postpones — so a factory counts as
		// "this ViewModel has scenarios" by its presence alone.
		const store = createLankaVM({
			name: "LazyRegisteredVM",
			createActions: () => ({}),
			scenarioHandlers: () => [
				{ scenario: createScenarioDouble(), handler: () => () => undefined },
			],
		});

		expect(registerViewModelMock).toHaveBeenCalledWith(store.getState(), "LazyRegisteredVM");
	});

	it("leaves the array form eager, so nothing changes for a ViewModel that had no problem", () => {
		const scenario = createScenarioDouble();
		let built = 0;

		const store = createLankaVM({
			name: "EagerVM",
			createActions: () => ({}),
			scenarioHandlers: [
				(() => {
					built += 1;
					return { scenario, handler: () => () => undefined };
				})(),
			],
		});

		// Built by the caller, before `createLankaVM` ever saw it — which is exactly
		// the shape the factory form exists as an alternative to.
		expect(built).toBe(1);
		expect(registerViewModelMock).toHaveBeenCalledWith(store.getState(), "EagerVM");
	});
});
