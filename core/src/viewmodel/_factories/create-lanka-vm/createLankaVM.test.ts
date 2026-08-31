/**
 * Building a ViewModel and wiring its scenario subscriptions.
 *
 * The duplicate-subscription test guards a sharp edge: the registry is keyed by
 * `eventType`, so two scenarios sharing one value collapse into a single binding
 * and the second handler is never subscribed — silently, including in test doubles.
 *
 * The render-optimization behaviour: `createLankaVM.renderOptimization.test.ts`.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../logger/lanka-logger/LankaLogger", () => ({
	lankaLogger: {
		printViewModelLog: vi.fn(),
	},
}));

import { createLankaVM } from "./createLankaVM";
import { lankaScenarioBootstrap } from "../../../scenario/lanka-scenario-bootstrap/LankaScenarioBootstrap";
describe("createLankaVM — construction and scenario lifecycle", () => {
	const registerViewModelMock = vi.spyOn(lankaScenarioBootstrap, "registerViewModel");

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("creates state/actions and resolves gateways/services", () => {
		const store = createLankaVM({
			name: "TestVM",
			states: { count: 0 },
			gateways: () => ({ gw: 123 }),
			services: { svc: "ok" },
			createActions: ({ gateways, services }) => ({
				getDeps: () => ({
					gw: gateways.gw,
					svc: services.svc,
				}),
			}),
		});

		const state = store.getState() as unknown as {
			count: number;
			getDeps: () => { gw: number; svc: string };
		};
		expect(state.count).toBe(0);
		expect(state.getDeps()).toEqual({
			gw: 123,
			svc: "ok",
		});
	});

	it("registers view model when scenarioHandlers provided", () => {
		const scenario = {
			name: "ScenarioVM",
			eventType: "EV",
			dataTypeName: "ScenarioData",
			subscribe: vi.fn(() => () => undefined),
			unsubscribe: vi.fn(() => () => undefined),
			trigger: vi.fn(),
		};

		const store = createLankaVM({
			name: "ScenarioVM",
			createActions: () => ({}),
			scenarioHandlers: [
				{
					scenario,
					handler: () => () => undefined,
				},
			],
		});

		expect(registerViewModelMock).toHaveBeenCalledWith(store.getState(), "ScenarioVM");
	});

	it("does not register view model when scenarioHandlers are missing", () => {
		createLankaVM({
			name: "NoScenarioVM",
			createActions: () => ({}),
		});

		expect(registerViewModelMock).not.toHaveBeenCalled();
	});

	it("initializes scenarios once and calls onInit", () => {
		let captured: ((data?: unknown) => void) | undefined;
		const scenario = {
			name: "InitScenario",
			eventType: "EV",
			dataTypeName: "ScenarioData",
			subscribe: vi.fn((cb: (data?: unknown) => void) => {
				captured = cb;
				return () => undefined;
			}),
			unsubscribe: vi.fn(),
			trigger: vi.fn(),
		};

		const onInit = vi.fn();

		const store = createLankaVM({
			name: "InitVM",
			createActions: () => ({}),
			onInit,
			scenarioHandlers: [
				{
					scenario,
					options: { priority: 1 },
					handler: () => () => undefined,
				},
			],
		});

		store.getState().initializeScenario();
		store.getState().initializeScenario();

		expect(scenario.subscribe).toHaveBeenCalledTimes(1);
		expect(scenario.subscribe).toHaveBeenCalledWith(
			captured,
			expect.objectContaining({
				usedBy: "InitVM",
				priority: 1,
			}),
		);
		expect(onInit).toHaveBeenCalledTimes(1);
	});

	it("skips duplicate subscriptions for same eventType", () => {
		const scenario = {
			name: "DupScenario",
			eventType: "EV",
			dataTypeName: "ScenarioData",
			subscribe: vi.fn(() => () => undefined),
			unsubscribe: vi.fn(() => () => undefined),
			trigger: vi.fn(),
		};

		const store = createLankaVM({
			name: "DupVM",
			createActions: () => ({}),
			scenarioHandlers: [
				{
					scenario,
					handler: () => () => undefined,
				},
				{
					scenario,
					handler: () => () => undefined,
				},
			],
		});

		store.getState().initializeScenario();

		expect(scenario.subscribe).toHaveBeenCalledTimes(1);
	});

	it("resetScenario unsubscribes and allows re-init", () => {
		// The factory unsubscribes with what `subscribe` returned, not by calling
		// `unsubscribe(callback)`. The double mirrors that contract.
		const off = vi.fn();
		const scenario = {
			name: "ResetScenario",
			eventType: "EV",
			dataTypeName: "ScenarioData",
			subscribe: vi.fn(() => off),
			unsubscribe: vi.fn(),
			trigger: vi.fn(),
		};

		const onReset = vi.fn();

		const store = createLankaVM({
			name: "ResetVM",
			createActions: () => ({}),
			onReset,
			scenarioHandlers: [
				{
					scenario,
					handler: () => () => undefined,
				},
			],
		});

		store.getState().initializeScenario();
		store.getState().resetScenario();

		expect(off).toHaveBeenCalledTimes(1);
		expect(onReset).toHaveBeenCalledTimes(1);

		store.getState().initializeScenario();
		expect(scenario.subscribe).toHaveBeenCalledTimes(2);
	});

	it("applies enhancers to state creator", () => {
		const enhancer = vi.fn((creator) => creator);

		createLankaVM({
			name: "EnhancedVM",
			createActions: () => ({}),
			enhancers: [enhancer],
		});

		expect(enhancer).toHaveBeenCalledTimes(1);
	});
});
