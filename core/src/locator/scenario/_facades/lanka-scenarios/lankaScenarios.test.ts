import { beforeEach, describe, expect, it, vi } from "vitest";
import { LankaScenariosRegistry } from "../../../../scenario/_registries/lanka-scenarios-registry/LankaScenariosRegistry";
import { ALankaScenario } from "../../../../scenario/_abstractions/lanka-scenario/ALankaScenario";
import type { ILankaScenario } from "../../../../scenario/_interfaces/ILankaScenario";

vi.mock("@lanka_di/Scenarios", () => {
	class GlobalScenario implements ILankaScenario<void> {
		static instances = 0;
		readonly name = "GlobalScenario";
		readonly eventType = "GLOBAL_EVENT";
		readonly dataTypeName = "GlobalData";

		constructor() {
			GlobalScenario.instances += 1;
		}

		trigger(): void {}
		subscribe(): () => void {
			return () => undefined;
		}
		unsubscribe(): void {}
	}

	return { GlobalScenario };
});

const setup = async () => {
	// `vi.resetModules()` in beforeEach also resets the module holding the active
	// instance pointer: the one the setup file created stays in the PREVIOUS module
	// graph. So the instance is created here, after the reset — otherwise the
	// locator asks for a pointer nobody set in this graph.
	const { createLanka } =
		await import("../../../../bootstrap/_factories/create-lanka/createLanka");
	const { lankaTestHost } = await import("@lankajs/tool-testing/lankaTestHost");
	createLanka({ host: lankaTestHost });
	const module = await import("./lankaScenarios");
	const scenariosModule = await import("@lanka_di/Scenarios");
	return {
		lankaScenarios: module.lankaScenarios,
		scenariosModule: scenariosModule as unknown as {
			GlobalScenario: { instances: number };
		},
	};
};

describe("lankaScenarios", () => {
	beforeEach(() => {
		LankaScenariosRegistry.getInstance().clear();
		ALankaScenario.clearAutoRegisteredScenarios();
		vi.resetModules();
	});

	it("resolves scenarios via proxy and caches the instance", async () => {
		const { lankaScenarios, scenariosModule } = await setup();
		const scenarios = lankaScenarios as unknown as Record<string, unknown>;

		const first = scenarios.globalScenario;
		const second = scenarios.globalScenario;

		expect(first).toBe(second);
		expect(scenariosModule.GlobalScenario.instances).toBe(1);
	});

	it("throws with the scenario-specific error prefix", async () => {
		const { lankaScenarios } = await setup();
		const scenarios = lankaScenarios as unknown as Record<string, unknown>;

		expect(() => scenarios._private).toThrow("Cannot access scenario with property: _private");
	});

	it("throws with the scenario-specific error prefix for symbol access", async () => {
		const { lankaScenarios } = await setup();

		expect(
			() => (lankaScenarios as unknown as Record<symbol, unknown>)[Symbol.iterator],
		).toThrow("Cannot access scenario with symbol property: Symbol(Symbol.iterator)");
	});
});
