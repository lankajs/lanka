import { beforeEach, describe, expect, it } from "vitest";
import { LankaScenariosRegistry } from "./LankaScenariosRegistry";
import { ALankaScenario } from "../../_abstractions/lanka-scenario/ALankaScenario";

class TestScenario extends ALankaScenario<{ id: number }> {
	readonly name = "TestScenario";
	readonly eventType = "TEST_EVENT";
	readonly dataTypeName = "TestData";
}

class AnotherScenario extends ALankaScenario<void> {
	readonly name = "AnotherScenario";
	readonly eventType = "ANOTHER_EVENT";
	readonly dataTypeName = "AnotherData";
}

describe("LankaScenariosRegistry", () => {
	let registry: LankaScenariosRegistry;

	beforeEach(() => {
		// The registry belongs to the framework instance, which is recreated before
		// every test. Taken at describe level it would be one for the whole file —
		// belonging to an instance that no longer exists by the first `it`.
		registry = LankaScenariosRegistry.getInstance();
		registry.clear();
		ALankaScenario.clearAutoRegisteredScenarios();
	});

	it("registers and retrieves scenario metadata", () => {
		const scenario = new TestScenario();

		const registered = registry.register(scenario);

		expect(registered).toBe(true);
		expect(registry.isRegistered("TestScenario")).toBe(true);
		expect(registry.getScenarioByName("TestScenario")).toBe(scenario);

		const metadata = registry.getMetadata("TestScenario");
		expect(metadata?.name).toBe("TestScenario");
		expect(metadata?.eventType).toBe("TEST_EVENT");
		expect(metadata?.dataTypeName).toBe("TestData");
		expect(metadata?.isRegistered).toBe(true);
	});

	it("returns false when registering duplicate scenario", () => {
		const scenario = new TestScenario();

		expect(registry.register(scenario)).toBe(true);
		expect(registry.register(scenario)).toBe(false);
	});

	it("unregisters scenario and updates metadata", () => {
		const scenario = new TestScenario();
		registry.register(scenario);

		const removed = registry.unregister("TestScenario");

		expect(removed).toBe(true);
		expect(registry.isRegistered("TestScenario")).toBe(false);
		expect(registry.getScenarioByName("TestScenario")).toBeUndefined();
		expect(registry.getMetadata("TestScenario")?.isRegistered).toBe(false);
	});

	it("collects auto-registered scenarios from ALankaScenario", () => {
		const scenario = new TestScenario();
		expect(registry.isRegistered("TestScenario")).toBe(false);

		registry.collectAutoRegisteredScenarios();

		expect(registry.isRegistered("TestScenario")).toBe(true);
		expect(registry.getScenarioByName("TestScenario")).toBe(scenario);
	});

	it("does not overwrite manually registered scenario when collecting auto-registered", () => {
		const manual = new TestScenario();
		registry.register(manual);

		registry.collectAutoRegisteredScenarios();

		expect(registry.getScenarioByName("TestScenario")).toBe(manual);
		expect(registry.isRegistered("TestScenario")).toBe(true);
	});

	it("returns all scenarios and metadata", () => {
		const a = new TestScenario();
		const b = new AnotherScenario();
		registry.register(a);
		registry.register(b);

		const scenarios = registry.getAllScenarios();
		const metadata = registry.getAllMetadata();

		expect(scenarios).toHaveLength(2);
		expect(metadata).toHaveLength(2);
		expect(scenarios).toEqual(expect.arrayContaining([a, b]));
	});

	it("clear removes all scenarios and metadata", () => {
		registry.register(new TestScenario());
		registry.register(new AnotherScenario());

		registry.clear();

		expect(registry.getAllScenarios()).toHaveLength(0);
		expect(registry.getAllMetadata()).toHaveLength(0);
	});
	it("stress: bulk register/unregister (timing)", () => {
		class StressScenario extends ALankaScenario<void> {
			static skipAutoRegistration = true;
			readonly name: string;
			readonly eventType: string;
			readonly dataTypeName = "StressData";

			constructor(index: number) {
				super();
				this.name = `StressScenario_${index}`;
				this.eventType = `STRESS_EVENT_${index}`;
			}
		}

		const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

		const scenarios: StressScenario[] = [];
		const start = now();

		for (let i = 0; i < 300; i += 1) {
			const scenario = new StressScenario(i);
			scenarios.push(scenario);
			registry.register(scenario);
		}

		for (const scenario of scenarios) {
			registry.unregister(scenario.name);
		}

		const durationMs = now() - start;

		console.info(`LankaScenariosRegistry stress duration: ${durationMs.toFixed(2)}ms`);
		expect(registry.getAllScenarios()).toHaveLength(0);
	});
});
