import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSingletons = vi.hoisted(() => {
	class ModuleService {
		static instances = 0;
		constructor() {
			ModuleService.instances += 1;
		}
	}
	class OriginalService {}
	class GetterService {}
	const NotAClass = { value: 1 };
	return {
		ModuleService,
		OriginalService,
		GetterService,
		NotAClass,
	};
});

vi.mock("@lanka_di/Singletons", () => {
	const module: Record<string, unknown> = {
		ModuleService: mockSingletons.ModuleService,
		AliasService: mockSingletons.OriginalService,
		NotAClass: mockSingletons.NotAClass,
	};

	Object.defineProperty(module, "GetterService", {
		get: () => mockSingletons.GetterService,
		enumerable: true,
	});

	return module;
});

import { LankaSingletonLocator } from "./LankaSingletonLocator";

class AlphaService {
	public id = "alpha";
}

class BetaService {
	public id = "beta";
}

describe("LankaSingletonLocator", () => {
	beforeEach(() => {
		mockSingletons.ModuleService.instances = 0;
	});

	it("resolves instances via registered class and caches them", () => {
		const locator = new LankaSingletonLocator();
		locator.register("AlphaService", AlphaService);

		const first = locator.get("alphaService");
		const second = locator.get("alphaService");

		expect(first).toBeInstanceOf(AlphaService);
		expect(second).toBe(first);
	});

	it("resolves instances via registered instance and returns same instance", () => {
		const locator = new LankaSingletonLocator();
		const instance = new BetaService();

		locator.registerInstance("BetaService", instance);

		const resolved = locator.get("betaService");

		expect(resolved).toBe(instance);
		expect(locator.isRegistered("BetaService")).toBe(true);
	});

	it("unregisterSingleton removes class and instance", () => {
		const locator = new LankaSingletonLocator();
		locator.register("AlphaService", AlphaService);
		locator.registerInstance("BetaService", new BetaService());

		locator.unregister("AlphaService");
		locator.unregister("BetaService");

		expect(locator.isRegistered("AlphaService")).toBe(false);
		expect(locator.isRegistered("BetaService")).toBe(false);
		expect(() => locator.get("alphaService")).toThrow(
			'Singleton "AlphaService" (accessed as "alphaService") not found. ' +
				"Make sure the class is exported from @lanka_di/Singletons.ts or registered via registerSingleton method.",
		);
	});

	it("uses singletonIndexModule to resolve classes", () => {
		const locator = new LankaSingletonLocator({
			singletonIndexModule: {
				GammaService: AlphaService,
			},
		});

		const resolved = locator.get("gammaService");

		expect(resolved).toBeInstanceOf(AlphaService);
	});

	it("resolves classes from lankaSingletons module by export key", () => {
		const locator = new LankaSingletonLocator();

		const first = locator.get("moduleService");
		const second = locator.get("moduleService");

		expect(first).toBeInstanceOf(mockSingletons.ModuleService);
		expect(second).toBe(first);
		expect(mockSingletons.ModuleService.instances).toBe(1);
	});

	/*
	 * There is no fallback to `Class.name`: minification drops that name too, so a
	 * lookup by it can only succeed where the export key already matched.
	 */

	it("resolves class via getter-based export descriptor", () => {
		const locator = new LankaSingletonLocator();

		const resolved = locator.get("getterService");

		expect(resolved).toBeInstanceOf(mockSingletons.GetterService);
	});

	it("registerSingletonInstance overrides class registration", () => {
		const locator = new LankaSingletonLocator();
		locator.register("AlphaService", AlphaService);
		const instance = new BetaService();

		locator.registerInstance("AlphaService", instance);

		const resolved = locator.get("alphaService");

		expect(resolved).toBe(instance);
	});

	it("registerSingleton clears cache to allow new class", () => {
		class AlphaServiceV2 {
			public id = "alpha-v2";
		}

		const locator = new LankaSingletonLocator();
		locator.register("AlphaService", AlphaService);
		const first = locator.get("alphaService");

		locator.register("AlphaService", AlphaServiceV2);
		const second = locator.get("alphaService");

		expect(first).toBeInstanceOf(AlphaService);
		expect(second).toBeInstanceOf(AlphaServiceV2);
	});
});
