import { beforeEach, describe, expect, it, vi } from "vitest";

// The bus is two modules, and a test replacing it must replace BOTH: the
// instance class `createLanka` builds from, and the ambient facade scenarios
// call. Mocking one leaves the other real, reaching for a runtime no test made.
vi.mock("../../event-bus/lanka-event-bus-instance/LankaEventBusInstance", () => ({
	LankaEventBusInstance: class {
		clearAllEvents = vi.fn();
		reset = vi.fn();
	},
}));

vi.mock("../../event-bus/_facades/lanka-event-bus/lankaEventBus", () => ({
	lankaEventBus: {
		dispatch: vi.fn(),
		subscribe: vi.fn(() => () => undefined),
		unsubscribe: vi.fn(() => () => undefined),
		registerEvent: vi.fn(),
	},
}));

vi.mock("../../../logger/lanka-logger/LankaLogger", () => ({
	lankaLogger: {
		printScenarioLog: vi.fn(),
	},
}));

import { ALankaScenario } from "./ALankaScenario";
import { LankaScenariosRegistry } from "../../_registries/lanka-scenarios-registry/LankaScenariosRegistry";
import { lankaLogger } from "../../../logger/lanka-logger/LankaLogger";
import { lankaEventBus } from "../../event-bus/_facades/lanka-event-bus/lankaEventBus";

class TestScenario extends ALankaScenario<{ id: number }> {
	readonly name = "TestScenario";
	readonly eventType = "TEST_EVENT";
	readonly dataTypeName = "TestData";
}

class ManualScenario extends ALankaScenario<void> {
	static skipAutoRegistration = true;
	readonly name = "ManualScenario";
	readonly eventType = "MANUAL_EVENT";
	readonly dataTypeName = "ManualData";
}

describe("ALankaScenario", () => {
	let registry: LankaScenariosRegistry;

	beforeEach(() => {
		// The registry belongs to the framework instance, which is recreated before
		// every test. Taken at describe level it would be one for the whole file —
		// belonging to an instance that no longer exists by the first `it`.
		registry = LankaScenariosRegistry.getInstance();
		vi.clearAllMocks();
		registry.clear();
		ALankaScenario.clearAutoRegisteredScenarios();
	});

	it("auto-registers instances by default", () => {
		const scenario = new TestScenario();

		const auto = ALankaScenario.getAutoRegisteredScenarios();

		expect(auto).toContain(scenario);
	});

	it("respects skipAutoRegistration", () => {
		const scenario = new ManualScenario();

		const auto = ALankaScenario.getAutoRegisteredScenarios();

		expect(auto).not.toContain(scenario);
	});

	it("registers and unregisters with LankaScenariosRegistry", () => {
		const scenario = new TestScenario();

		expect(registry.isRegistered("TestScenario")).toBe(false);
		expect(scenario.register()).toBe(true);
		expect(registry.isRegistered("TestScenario")).toBe(true);

		expect(scenario.unregister()).toBe(true);
		expect(registry.isRegistered("TestScenario")).toBe(false);
	});

	it("dispatches events on trigger", () => {
		const scenario = new TestScenario();
		const payload = { id: 1 };

		scenario.trigger(payload);

		expect(lankaLogger.printScenarioLog).toHaveBeenCalledWith(
			"TRIGGER Scenario",
			"TestScenario",
			payload,
		);
		expect(lankaEventBus.dispatch).toHaveBeenCalledWith("TEST_EVENT", payload, "TestScenario");
	});

	it("subscribes with usedBy defaulting to scenario name", () => {
		const scenario = new TestScenario();
		const handler = vi.fn();

		scenario.subscribe(handler);

		expect(lankaLogger.printScenarioLog).toHaveBeenCalledWith(
			"SUBSCRIBE Scenario",
			"TestScenario",
			"TestData",
		);
		expect(lankaEventBus.subscribe).toHaveBeenCalledWith("TEST_EVENT", handler, {
			usedBy: "TestScenario",
		});
	});

	it("respects custom subscribe options (usedBy override)", () => {
		const scenario = new TestScenario();
		const handler = vi.fn();

		scenario.subscribe(handler, {
			usedBy: "CustomVM",
			priority: 2,
		});

		expect(lankaEventBus.subscribe).toHaveBeenCalledWith("TEST_EVENT", handler, {
			usedBy: "CustomVM",
			priority: 2,
		});
	});

	it("returns an unsubscribe function rather than a by-callback method", () => {
		const scenario = new TestScenario();
		const off = vi.fn();
		vi.mocked(lankaEventBus.subscribe).mockReturnValue(off);

		const stop = scenario.subscribe(vi.fn());
		stop();

		expect(off).toHaveBeenCalledTimes(1);
		// A scenario has no unsubscribe-by-callback on purpose: it removes the first
		// entry with that callback, not necessarily the caller's own.
		expect("unsubscribe" in scenario).toBe(false);
	});
	it("stress: repeated trigger dispatch (timing)", () => {
		const scenario = new TestScenario();
		const payload = { id: 1 };
		const iterations = 500;

		const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

		const start = now();
		for (let i = 0; i < iterations; i += 1) {
			scenario.trigger(payload);
		}
		const durationMs = now() - start;

		console.info(`ALankaScenario trigger stress duration: ${durationMs.toFixed(2)}ms`);
		expect(lankaEventBus.dispatch).toHaveBeenCalledTimes(iterations);
	});
});
