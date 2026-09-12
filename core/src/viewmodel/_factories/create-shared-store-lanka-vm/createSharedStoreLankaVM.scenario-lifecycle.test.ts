import { beforeEach, describe, expect, it, vi } from "vitest";
import { ILankaScenario } from "../../../scenario/_interfaces/ILankaScenario";
import { lankaScenarioBootstrap } from "../../../scenario/lanka-scenario-bootstrap/LankaScenarioBootstrap";
import { ALankaSharedStore } from "../../_abstractions/lanka-shared-store/ALankaSharedStore";
import { createSharedStoreLankaVM } from "./createSharedStoreLankaVM";

interface ITestSharedState {
	count: number;
}

class TestSharedStore extends ALankaSharedStore<ITestSharedState> {
	constructor() {
		super(() => ({ count: 0 }));
	}
}

function createMockScenario<T>(eventType: string): {
	scenario: ILankaScenario<T>;
	trigger: (data?: T) => void;
} {
	const subscribers = new Set<(data?: T) => void>();

	const trigger = vi.fn((data?: T) => {
		subscribers.forEach((cb) => cb(data));
	});

	const scenario: ILankaScenario<T> = {
		name: `Scenario:${eventType}`,
		eventType,
		dataTypeName: "test",
		trigger,
		subscribe: vi.fn((cb: (data?: unknown) => void) => {
			subscribers.add(cb);
			return () => subscribers.delete(cb);
		}),
	};

	return { scenario, trigger };
}

describe("createSharedStoreLankaVM — scenario lifecycle", () => {
	const registerViewModelMock = vi.spyOn(lankaScenarioBootstrap, "registerViewModel");

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("registers scenario view model when scenarioHandlers provided", () => {
		const sharedStore = new TestSharedStore();
		const scenario = createMockScenario("EV").scenario;

		createSharedStoreLankaVM<ITestSharedState, Record<string, never>, TestSharedStore>({
			name: "ScenarioSharedVM",
			store: sharedStore,
			scenarioHandlers: [
				{
					scenario,
					handler: () => () => undefined,
				},
			],
			createActions: () => ({}),
		});

		expect(registerViewModelMock).toHaveBeenCalledWith(
			expect.objectContaining({
				initializeScenario: expect.any(Function),
				resetScenario: expect.any(Function),
			}),
			"ScenarioSharedVM",
		);
	});

	it("does not register scenario view model when scenarioHandlers are missing", () => {
		const sharedStore = new TestSharedStore();

		createSharedStoreLankaVM<ITestSharedState, Record<string, never>, TestSharedStore>({
			name: "NoScenarioSharedVM",
			store: sharedStore,
			createActions: () => ({}),
		});

		expect(registerViewModelMock).not.toHaveBeenCalled();
	});

	// Bootstrap is the only caller of `initializeScenario`, where `onInit` runs; a
	// ViewModel it never heard of never gets either.
	it("registers scenario view model when only onInit is declared", () => {
		createSharedStoreLankaVM<ITestSharedState, Record<string, never>, TestSharedStore>({
			name: "InitOnlySharedVM",
			store: new TestSharedStore(),
			createActions: () => ({}),
			onInit: vi.fn(),
		});

		expect(registerViewModelMock).toHaveBeenCalledWith(
			expect.objectContaining({ initializeScenario: expect.any(Function) }),
			"InitOnlySharedVM",
		);
	});

	it("registers scenario view model when only onReset is declared", () => {
		createSharedStoreLankaVM<ITestSharedState, Record<string, never>, TestSharedStore>({
			name: "ResetOnlySharedVM",
			store: new TestSharedStore(),
			createActions: () => ({}),
			onReset: vi.fn(),
		});

		expect(registerViewModelMock).toHaveBeenCalledWith(
			expect.objectContaining({ resetScenario: expect.any(Function) }),
			"ResetOnlySharedVM",
		);
	});

	it("initializes scenarios once and calls onInit", () => {
		const sharedStore = new TestSharedStore();

		let captured: ((data?: unknown) => void) | undefined;
		const scenario = {
			name: "InitScenario",
			eventType: "EV",
			dataTypeName: "InitData",
			subscribe: vi.fn((cb: (data?: unknown) => void) => {
				captured = cb;
			}),
			unsubscribe: vi.fn(() => () => undefined),
			trigger: vi.fn(),
		} as unknown as ILankaScenario<unknown>;

		const onInit = vi.fn();

		const vm = createSharedStoreLankaVM<
			ITestSharedState,
			Record<string, never>,
			TestSharedStore
		>({
			name: "InitSharedVM",
			store: sharedStore,
			onInit,
			scenarioHandlers: [
				{
					scenario,
					options: { priority: 1 },
					handler: () => () => undefined,
				},
			],
			createActions: () => ({}),
		});

		vm.getState().initializeScenario();
		vm.getState().initializeScenario();

		expect(scenario.subscribe).toHaveBeenCalledTimes(1);
		expect(scenario.subscribe).toHaveBeenCalledWith(
			captured,
			expect.objectContaining({
				usedBy: "InitSharedVM",
				priority: 1,
			}),
		);
		expect(onInit).toHaveBeenCalledTimes(1);
	});

	it("resetScenario unsubscribes and allows re-init", () => {
		const sharedStore = new TestSharedStore();

		// The double mirrors the contract: the factory unsubscribes with what
		// `subscribe` returned.
		const off = vi.fn();
		const scenario = {
			name: "ResetScenario",
			eventType: "EV",
			dataTypeName: "ResetData",
			subscribe: vi.fn(() => off),
			unsubscribe: vi.fn(),
			trigger: vi.fn(),
		} as unknown as ILankaScenario<unknown>;

		const onReset = vi.fn();

		const vm = createSharedStoreLankaVM<
			ITestSharedState,
			Record<string, never>,
			TestSharedStore
		>({
			name: "ResetSharedVM",
			store: sharedStore,
			onReset,
			scenarioHandlers: [
				{
					scenario,
					handler: () => () => undefined,
				},
			],
			createActions: () => ({}),
		});

		vm.getState().initializeScenario();
		vm.getState().resetScenario();

		expect(off).toHaveBeenCalledTimes(1);
		expect(onReset).toHaveBeenCalledTimes(1);

		vm.getState().initializeScenario();
		expect(scenario.subscribe).toHaveBeenCalledTimes(2);
	});
});
