import { describe, it, expect, vi, beforeEach } from "vitest";
import { createStatelessLankaVM } from "./createStatelessLankaVM";
import { ILankaScenario } from "../../../scenario/_interfaces/ILankaScenario";

function createMockScenario<T>(eventType: string): {
	scenario: ILankaScenario<T>;
	trigger: (data?: T) => void;
	unsubscribe: ReturnType<typeof vi.fn>;
} {
	const subscribers = new Set<(data?: T) => void>();

	const trigger = vi.fn((data?: T) => {
		subscribers.forEach((cb) => cb(data));
	});

	const unsubscribe = vi.fn();

	const scenario: ILankaScenario<T> = {
		name: `Scenario:${eventType}`,
		eventType,
		dataTypeName: "test",
		trigger,
		subscribe: vi.fn((cb: (data?: T) => void) => {
			subscribers.add(cb);
			return unsubscribe;
		}),
	};

	return { scenario, trigger, unsubscribe };
}

vi.mock("../../../scenario/lanka-scenario-bootstrap/LankaScenarioBootstrap", () => ({
	lankaScenarioBootstrap: {
		registerViewModel: vi.fn(),
		// A mock factory replaces the module ENTIRELY: a method missing here is not
		// "taken from the real one", it simply does not exist — and the failure
		// arrives from a file this test never mentions.
		adoptDeclaredViewModels: vi.fn(),
	},
}));
describe("createStatelessLankaVM (strict TS)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("creates VM with typed actions", () => {
		type TActions = {
			hello: () => string;
		};

		const vm = createStatelessLankaVM<TActions>({
			name: "BasicVM",
			createActions: () => ({
				hello: () => "world",
			}),
		});

		expect(vm.getState().hello()).toBe("world");
	});

	it("allows set/get usage internally", () => {
		type TActions = {
			setFlag: () => void;
			getFlag: () => boolean;
		};

		let flag = false;

		const vm = createStatelessLankaVM<TActions>({
			name: "SetGetVM",
			createActions: ({ set, get }) => ({
				setFlag: () => {
					flag = true;
					set(get());
				},
				getFlag: () => flag,
			}),
		});

		vm.getState().setFlag();
		expect(vm.getState().getFlag()).toBe(true);
	});

	it("injects gateways and services once", () => {
		type TActions = {
			getDeps: () => string[];
		};

		const gatewaysFactory = vi.fn(() => ({
			api: "gw",
		}));
		const servicesFactory = vi.fn(() => ({
			logger: "svc",
		}));

		const vm = createStatelessLankaVM<TActions, { api: string }, { logger: string }>({
			name: "DIVM",
			gateways: gatewaysFactory,
			services: servicesFactory,
			createActions: ({ gateways, services }) => ({
				getDeps: () => [gateways.api, services.logger],
			}),
		});

		expect(vm.getState().getDeps()).toEqual(["gw", "svc"]);
		expect(gatewaysFactory).toHaveBeenCalledTimes(1);
		expect(servicesFactory).toHaveBeenCalledTimes(1);
	});

	it("subscribes and reacts to scenario trigger", () => {
		type TActions = Record<string, never>;

		const { scenario, trigger } = createMockScenario<number>("PING");
		const handler = vi.fn();

		const vm = createStatelessLankaVM<TActions>({
			name: "ScenarioVM",
			scenarioHandlers: [
				{
					scenario,
					handler: () => handler,
				},
			],
			createActions: () => ({}),
		});

		vm.getState().initializeScenario();
		trigger(123);

		expect(handler).toHaveBeenCalledWith(123);
	});

	it("does not double-subscribe on repeated init", () => {
		const { scenario } = createMockScenario("EVENT");

		const vm = createStatelessLankaVM({
			name: "NoDoubleInitVM",
			scenarioHandlers: [
				{
					scenario,
					handler: () => vi.fn(),
				},
			],
			createActions: () => ({}),
		});

		vm.getState().initializeScenario();
		vm.getState().initializeScenario();

		expect(scenario.subscribe).toHaveBeenCalledTimes(1);
	});

	it("unsubscribes on reset and allows re-init", () => {
		const { scenario, unsubscribe } = createMockScenario("RESET");

		const vm = createStatelessLankaVM({
			name: "ResetVM",
			scenarioHandlers: [
				{
					scenario,
					handler: () => vi.fn(),
				},
			],
			createActions: () => ({}),
		});

		vm.getState().initializeScenario();
		vm.getState().resetScenario();
		vm.getState().initializeScenario();

		// Exactly the subscription that was made is released: the stored value is
		// the function `subscribe` returned, not the callback.
		expect(unsubscribe).toHaveBeenCalledTimes(1);
		expect(scenario.subscribe).toHaveBeenCalledTimes(2);
	});

	it("calls onInit and onReset", () => {
		const onInit = vi.fn();
		const onReset = vi.fn();

		const vm = createStatelessLankaVM({
			name: "HooksVM",
			createActions: () => ({}),
			onInit,
			onReset,
		});

		vm.getState().initializeScenario();
		vm.getState().resetScenario();

		expect(onInit).toHaveBeenCalledOnce();
		expect(onReset).toHaveBeenCalledOnce();
	});

	it("supports selector usage", () => {
		type TActions = {
			value: number;
		};

		const vm = createStatelessLankaVM<TActions>({
			name: "SelectorVM",
			createActions: () => ({
				value: 42,
			}),
		});

		expect(vm((s) => s.value)).toBe(42);
	});

	it("registers VM in LankaScenarioBootstrap if scenarios exist", async () => {
		const { lankaScenarioBootstrap } =
			await import("../../../scenario/lanka-scenario-bootstrap/LankaScenarioBootstrap");

		createStatelessLankaVM({
			name: "BootstrapVM",
			scenarioHandlers: [
				{
					scenario: createMockScenario("BOOT").scenario,
					handler: () => vi.fn(),
				},
			],
			createActions: () => ({}),
		});

		expect(lankaScenarioBootstrap.registerViewModel).toHaveBeenCalledOnce();
	});

	// `onInit` runs inside `initializeScenario`, which only bootstrap calls on the
	// ViewModels it knows. One that declares a hook and no scenarios used to stay
	// unknown, so the hook never ran.
	it("registers VM in LankaScenarioBootstrap when only onInit is declared", async () => {
		const { lankaScenarioBootstrap } =
			await import("../../../scenario/lanka-scenario-bootstrap/LankaScenarioBootstrap");

		createStatelessLankaVM({
			name: "InitOnlyStatelessVM",
			createActions: () => ({}),
			onInit: vi.fn(),
		});

		expect(lankaScenarioBootstrap.registerViewModel).toHaveBeenCalledWith(
			expect.anything(),
			"InitOnlyStatelessVM",
		);
	});

	it("registers VM in LankaScenarioBootstrap when only onReset is declared", async () => {
		const { lankaScenarioBootstrap } =
			await import("../../../scenario/lanka-scenario-bootstrap/LankaScenarioBootstrap");

		createStatelessLankaVM({
			name: "ResetOnlyStatelessVM",
			createActions: () => ({}),
			onReset: vi.fn(),
		});

		expect(lankaScenarioBootstrap.registerViewModel).toHaveBeenCalledWith(
			expect.anything(),
			"ResetOnlyStatelessVM",
		);
	});

	it("stress: repeated stateless getState access (timing)", () => {
		type TActions = {
			getValue: () => number;
		};

		const vm = createStatelessLankaVM<TActions>({
			name: "StatelessStressVM",
			createActions: () => ({
				getValue: () => 42,
			}),
		});

		const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

		const start = now();
		for (let i = 0; i < 1000; i += 1) {
			vm.getState();
		}
		const durationMs = now() - start;

		console.info(`createStatelessLankaVM getState stress duration: ${durationMs.toFixed(2)}ms`);

		expect(vm.getState().getValue()).toBe(42);
	});
});
