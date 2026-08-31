import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@lanka_di/SharedStores", async () => {
	const { ALankaSharedStore } =
		await import("../../../../viewmodel/_abstractions/lanka-shared-store/ALankaSharedStore");

	class GlobalSharedStore extends ALankaSharedStore<{
		value: number;
	}> {
		static instances = 0;
		constructor() {
			super(() => ({ value: 1 }));
			GlobalSharedStore.instances += 1;
		}
	}

	return { GlobalSharedStore };
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
	const module = await import("./lankaSharedStores");
	const sharedStoresModule = await import("@lanka_di/SharedStores");
	return {
		lankaSharedStores: module.lankaSharedStores,
		sharedStoresModule: sharedStoresModule as unknown as {
			GlobalSharedStore: { instances: number };
		},
	};
};

describe("lankaSharedStores", () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it("resolves shared stores via proxy and caches the instance", async () => {
		const { lankaSharedStores, sharedStoresModule } = await setup();
		const sharedStores = lankaSharedStores as unknown as Record<string, unknown>;
		sharedStoresModule.GlobalSharedStore.instances = 0;

		const first = sharedStores.globalSharedStore;
		const second = sharedStores.globalSharedStore;

		expect(first).toBe(second);
		expect(sharedStoresModule.GlobalSharedStore.instances).toBe(1);
	});

	it("throws with shared-store-specific error prefix for protected properties", async () => {
		const { lankaSharedStores } = await setup();
		const sharedStores = lankaSharedStores as unknown as Record<string, unknown>;

		expect(() => sharedStores.clearCache).toThrow(
			"Cannot access shared store with property: clearCache",
		);
	});
});
