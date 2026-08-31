import { beforeEach, describe, expect, it, vi } from "vitest";

// The bus is two modules, and a test replacing it must replace BOTH: the
// instance class `createLanka` builds from, and the ambient facade scenarios
// call. Mocking one leaves the other real, reaching for a runtime no test made.
vi.mock("../event-bus/lanka-event-bus-instance/LankaEventBusInstance", () => ({
	LankaEventBusInstance: class {
		clearAllEvents = vi.fn();
		reset = vi.fn();
	},
}));

vi.mock("../event-bus/_facades/lanka-event-bus/lankaEventBus", () => ({
	lankaEventBus: {
		dispatch: vi.fn(),
		subscribe: vi.fn(() => () => undefined),
		unsubscribe: vi.fn(() => () => undefined),
		registerEvent: vi.fn(),
	},
}));

vi.mock("../../logger/lanka-logger/LankaLogger", () => ({
	lankaLogger: {
		printScenarioLog: vi.fn(),
		printViewModelLog: vi.fn(),
	},
}));

vi.mock("@lanka_di/Scenarios", async () => {
	const { ALankaScenario } = await import("../_abstractions/lanka-scenario/ALankaScenario");

	class ScenarioA extends ALankaScenario<void> {
		static instances: ScenarioA[] = [];
		readonly name = "ScenarioA";
		readonly eventType = "E1";
		readonly dataTypeName = "ScenarioAData";
		initialize = vi.fn();

		constructor() {
			super();
			ScenarioA.instances.push(this);
		}
	}

	class ScenarioB extends ALankaScenario<void> {
		static instances: ScenarioB[] = [];
		readonly name = "ScenarioB";
		readonly eventType = "E1";
		readonly dataTypeName = "ScenarioBData";
		initialize = vi.fn();

		constructor() {
			super();
			ScenarioB.instances.push(this);
		}
	}

	class ThrowingScenario {
		constructor() {
			throw new Error("boom");
		}
	}

	return {
		ScenarioA,
		ScenarioB,
		ThrowingScenario,
		notAClass: 123,
	};
});

import { lankaScenarioBootstrap } from "./LankaScenarioBootstrap";
import { LankaScenariosRegistry } from "../_registries/lanka-scenarios-registry/LankaScenariosRegistry";
import { LankaScenarioVMRegistry } from "../_registries/lanka-scenario-vm-registry/LankaScenarioVMRegistry";
import { ALankaScenario } from "../_abstractions/lanka-scenario/ALankaScenario";
import type { ILankaScenarioVM } from "../_interfaces/ILankaScenarioVM";
import * as ScenariosModule from "@lanka_di/Scenarios";
import { lankaEventBus } from "../event-bus/_facades/lanka-event-bus/lankaEventBus";

const resetBootstrapState = () => {
	(
		lankaScenarioBootstrap as unknown as {
			isBootstrapped: boolean;
			initializedViewModels: WeakSet<ILankaScenarioVM>;
		}
	).isBootstrapped = false;
	(
		lankaScenarioBootstrap as unknown as {
			initializedViewModels: WeakSet<ILankaScenarioVM>;
		}
	).initializedViewModels = new WeakSet();
};

describe("LankaScenarioBootstrap", () => {
	let scenariosRegistry: LankaScenariosRegistry;
	let viewModelsRegistry: LankaScenarioVMRegistry;
	const mockedModule = ScenariosModule as unknown as {
		ScenarioA: { instances: unknown[] };
		ScenarioB: { instances: unknown[] };
	};

	beforeEach(() => {
		// The registry belongs to the framework instance, which is recreated before
		// every test. Taken at describe level it would be one for the whole file —
		// belonging to an instance that no longer exists by the first `it`.
		scenariosRegistry = LankaScenariosRegistry.getInstance();
		viewModelsRegistry = LankaScenarioVMRegistry.getInstance();
		vi.clearAllMocks();
		scenariosRegistry.clear();
		viewModelsRegistry.clear();
		ALankaScenario.clearAutoRegisteredScenarios();
		resetBootstrapState();
		mockedModule.ScenarioA.instances = [];
		mockedModule.ScenarioB.instances = [];
	});

	it("registers event types once and initializes every scenario", () => {
		lankaScenarioBootstrap.bootstrap();

		expect(mockedModule.ScenarioA.instances).toHaveLength(1);
		expect(mockedModule.ScenarioB.instances).toHaveLength(1);

		expect(lankaEventBus.registerEvent).toHaveBeenCalledTimes(1);
		expect(lankaEventBus.registerEvent).toHaveBeenCalledWith(
			"E1",
			expect.objectContaining({
				dataType: "ScenarioAData",
				description: "Scenario: ScenarioA",
				usedBy: ["ScenarioA"],
				priority: 0,
			}),
		);

		const [scenarioA] = mockedModule.ScenarioA.instances as Array<{
			initialize: ReturnType<typeof vi.fn>;
		}>;
		const [scenarioB] = mockedModule.ScenarioB.instances as Array<{
			initialize: ReturnType<typeof vi.fn>;
		}>;

		expect(scenarioA.initialize).toHaveBeenCalledTimes(1);
		expect(scenarioB.initialize).toHaveBeenCalledTimes(1);
	});

	it("ignores invalid exports and constructor failures", () => {
		expect(() => lankaScenarioBootstrap.bootstrap()).not.toThrow();
		expect(lankaEventBus.registerEvent).toHaveBeenCalledTimes(1);
	});

	it("initializes view models created before bootstrap once", () => {
		const viewModel: ILankaScenarioVM = {
			initializeScenario: vi.fn(),
			resetScenario: vi.fn(),
		};

		viewModelsRegistry.register(viewModel);

		lankaScenarioBootstrap.bootstrap();
		lankaScenarioBootstrap.bootstrap();

		expect(viewModel.initializeScenario).toHaveBeenCalledTimes(1);
	});

	it("registerViewModel defers initialization until bootstrap", () => {
		const viewModel: ILankaScenarioVM = {
			initializeScenario: vi.fn(),
			resetScenario: vi.fn(),
		};

		lankaScenarioBootstrap.registerViewModel(viewModel, "TestVM");
		expect(viewModel.initializeScenario).not.toHaveBeenCalled();

		lankaScenarioBootstrap.bootstrap();
		expect(viewModel.initializeScenario).toHaveBeenCalledTimes(1);
	});

	it("registerViewModel initializes immediately when bootstrapped and skips duplicates", () => {
		// The scenario layer is brought to the required state the same way the
		// application does it, not by forging an internal flag.
		lankaScenarioBootstrap.bootstrap();

		const viewModel: ILankaScenarioVM = {
			initializeScenario: vi.fn(),
			resetScenario: vi.fn(),
		};

		lankaScenarioBootstrap.registerViewModel(viewModel, "TestVM");
		lankaScenarioBootstrap.registerViewModel(viewModel, "TestVM");

		expect(viewModel.initializeScenario).toHaveBeenCalledTimes(1);
	});
	it("stress: repeated bootstrap calls (timing)", () => {
		lankaScenarioBootstrap.bootstrap();

		const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

		const start = now();
		for (let i = 0; i < 200; i += 1) {
			lankaScenarioBootstrap.bootstrap();
		}
		const durationMs = now() - start;

		console.info(`LankaScenarioBootstrap stress duration: ${durationMs.toFixed(2)}ms`);
		expect(lankaEventBus.registerEvent).toHaveBeenCalledTimes(1);
	});
});
