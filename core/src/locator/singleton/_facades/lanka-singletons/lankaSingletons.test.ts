import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@lanka_di/Singletons", () => {
	class GlobalSingleton {
		static instances = 0;
		readonly name = "GlobalSingleton";
		constructor() {
			GlobalSingleton.instances += 1;
		}
	}

	return { GlobalSingleton };
});

const setup = async () => {
	const module = await import("./lankaSingletons");
	const singletonsModule = await import("@lanka_di/Singletons");
	return {
		lankaSingletons: module.lankaSingletons,
		singletonsModule: singletonsModule as unknown as {
			GlobalSingleton: { instances: number };
		},
	};
};

describe("lankaSingletons", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("resolves singletons via proxy and caches the instance", async () => {
		const { lankaSingletons, singletonsModule } = await setup();
		const singletons = lankaSingletons as unknown as Record<string, unknown>;
		singletonsModule.GlobalSingleton.instances = 0;

		const first = singletons.globalSingleton;
		const second = singletons.globalSingleton;

		expect(first).toBe(second);
		expect(singletonsModule.GlobalSingleton.instances).toBe(1);
	});

	it("throws with the singleton-specific error prefix for protected properties", async () => {
		const { lankaSingletons } = await setup();
		const singletons = lankaSingletons as unknown as Record<string, unknown>;

		expect(() => singletons.clearCache).toThrow(
			"Cannot access singleton with property: clearCache",
		);
	});
});
