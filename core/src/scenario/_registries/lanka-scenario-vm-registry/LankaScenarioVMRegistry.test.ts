import { beforeEach, describe, expect, it } from "vitest";
import { LankaScenarioVMRegistry } from "./LankaScenarioVMRegistry";
import type { ILankaScenarioVM } from "../../_interfaces/ILankaScenarioVM";

const makeViewModel = (): ILankaScenarioVM => ({
	initializeScenario: () => undefined,
	resetScenario: () => undefined,
});

describe("LankaScenarioVMRegistry", () => {
	let registry: LankaScenarioVMRegistry;

	beforeEach(() => {
		// The registry belongs to the framework instance, which is recreated before
		// every test. Taken at describe level it would be one for the whole file —
		// belonging to an instance that no longer exists by the first `it`.
		registry = LankaScenarioVMRegistry.getInstance();
		registry.clear();
	});

	it("registers and retrieves view models", () => {
		const vm = makeViewModel();

		expect(registry.register(vm)).toBe(true);
		expect(registry.isRegistered(vm)).toBe(true);
		expect(registry.getAllViewModels()).toEqual([vm]);
	});

	it("returns false on duplicate register", () => {
		const vm = makeViewModel();

		expect(registry.register(vm)).toBe(true);
		expect(registry.register(vm)).toBe(false);
	});

	it("unregister removes view model", () => {
		const vm = makeViewModel();
		registry.register(vm);

		registry.unregister(vm);

		expect(registry.isRegistered(vm)).toBe(false);
		expect(registry.getAllViewModels()).toHaveLength(0);
	});

	it("clear removes all view models", () => {
		registry.register(makeViewModel());
		registry.register(makeViewModel());

		registry.clear();

		expect(registry.getAllViewModels()).toHaveLength(0);
	});

	it("unregister is safe for unknown view models", () => {
		const registered = makeViewModel();
		const other = makeViewModel();
		registry.register(registered);

		registry.unregister(other);

		expect(registry.isRegistered(registered)).toBe(true);
		expect(registry.getAllViewModels()).toEqual([registered]);
	});
	it("stress: bulk register/unregister (timing)", () => {
		const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

		const start = now();
		const vms = Array.from({ length: 500 }, () => makeViewModel());

		for (const vm of vms) {
			registry.register(vm);
		}
		for (const vm of vms) {
			registry.unregister(vm);
		}

		const durationMs = now() - start;

		console.info(`LankaScenarioVMRegistry stress duration: ${durationMs.toFixed(2)}ms`);
		expect(registry.getAllViewModels()).toHaveLength(0);
	});
});
