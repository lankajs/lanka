import { beforeEach, describe, expect, it, vi } from "vitest";
import { LankaScenarioLocator } from "./LankaScenarioLocator";
import { LankaScenariosRegistry } from "../../../scenario/_registries/lanka-scenarios-registry/LankaScenariosRegistry";
import { ALankaScenario } from "../../../scenario/_abstractions/lanka-scenario/ALankaScenario";
import type { ILankaScenario } from "../../../scenario/_interfaces/ILankaScenario";
import * as ScenariosModule from "@lanka_di/Scenarios";

vi.mock("@lanka_di/Scenarios", () => {
	class BaseScenario implements ILankaScenario<void> {
		readonly name: string;
		readonly eventType: string;
		readonly dataTypeName: string;

		constructor(name: string) {
			this.name = name;
			this.eventType = `${name}_EVENT`;
			this.dataTypeName = `${name}Data`;
		}

		trigger(): void {}
		subscribe(): () => void {
			return () => undefined;
		}
		unsubscribe(): void {}
	}

	class ExportedScenario extends BaseScenario {
		static instances = 0;
		constructor() {
			super("ExportedScenario");
			ExportedScenario.instances += 1;
		}
	}

	class CachedScenario extends BaseScenario {
		static instances = 0;
		constructor() {
			super("CachedScenario");
			CachedScenario.instances += 1;
		}
	}

	class RegistryScenario extends BaseScenario {
		static instances = 0;
		constructor() {
			super("RegistryScenario");
			RegistryScenario.instances += 1;
		}
	}

	class AliasScenario extends BaseScenario {
		static instances = 0;
		constructor() {
			super("RealScenario");
			AliasScenario.instances += 1;
		}
	}

	class BrokenScenario {
		constructor() {
			throw new Error("boom");
		}
	}

	return {
		ExportedScenario,
		CachedScenario,
		RegistryScenario,
		AliasScenario,
		BrokenScenario,
		notAClass: 123,
	};
});

class AutoScenario extends ALankaScenario<void> {
	readonly name = "AutoScenario";
	readonly eventType = "AUTO_EVENT";
	readonly dataTypeName = "AutoData";
}

describe("LankaScenarioLocator", () => {
	let registry: LankaScenariosRegistry;
	const mockedModule = ScenariosModule as unknown as {
		CachedScenario: {
			instances: number;
			new (): ILankaScenario<void>;
		};
		RegistryScenario: {
			instances: number;
			new (): ILankaScenario<void>;
		};
	};

	beforeEach(() => {
		// The registry belongs to the framework instance, which is recreated before
		// every test. Taken at describe level it would be one for the whole file —
		// belonging to an instance that no longer exists by the first `it`.
		registry = LankaScenariosRegistry.getInstance();
		registry.clear();
		ALankaScenario.clearAutoRegisteredScenarios();
	});

	it("prefers a registry instance over module exports", () => {
		const locator = new LankaScenarioLocator();
		const registered = new mockedModule.RegistryScenario();

		registry.register(registered);

		const resolved = locator.get("registryScenario");

		expect(resolved).toBe(registered);
		expect(mockedModule.RegistryScenario.instances).toBe(1);
	});

	it("returns auto-registered scenarios and registers them", () => {
		const locator = new LankaScenarioLocator();
		const scenario = new AutoScenario();

		expect(registry.isRegistered("AutoScenario")).toBe(false);

		const resolved = locator.get("autoScenario");

		expect(resolved).toBe(scenario);
		expect(registry.isRegistered("AutoScenario")).toBe(true);
	});

	it("creates from module export and caches the instance", () => {
		const locator = new LankaScenarioLocator();

		const first = locator.get("cachedScenario");
		const second = locator.get("cachedScenario");

		expect(first).toBe(second);
		expect(mockedModule.CachedScenario.instances).toBe(1);
		expect(registry.isRegistered("CachedScenario")).toBe(true);
	});

	it("falls back to instance name when export key is different", () => {
		const locator = new LankaScenarioLocator();

		const resolved = locator.get("realScenario");

		expect(resolved.name).toBe("RealScenario");
		expect(registry.isRegistered("RealScenario")).toBe(true);
	});

	it("throws with helpful details when scenario is missing", () => {
		const locator = new LankaScenarioLocator();

		expect(() => locator.get("missingScenario")).toThrow(
			'Scenario "MissingScenario" (accessed as "missingScenario") not found. ' +
				'Make sure the scenario class extends ALankaScenario and has name="MissingScenario".',
		);
	});
});
