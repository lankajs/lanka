import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@lanka_di/SharedStores", async () => {
	const { ALankaSharedStore } =
		await import("../../../viewmodel/_abstractions/lanka-shared-store/ALankaSharedStore");

	class FooSharedStore extends ALankaSharedStore<{
		value: number;
	}> {
		static instances = 0;
		constructor() {
			super(() => ({ value: 1 }));
			FooSharedStore.instances += 1;
		}
	}

	class OriginalSharedStore extends ALankaSharedStore<{
		value: number;
	}> {
		static instances = 0;
		constructor() {
			super(() => ({ value: 2 }));
			OriginalSharedStore.instances += 1;
		}
	}

	class GetterSharedStore extends ALankaSharedStore<{
		value: number;
	}> {
		static instances = 0;
		constructor() {
			super(() => ({ value: 3 }));
			GetterSharedStore.instances += 1;
		}
	}

	const module: Record<string, unknown> = {
		FooSharedStore,
		AliasSharedStore: OriginalSharedStore,
		NotAClass: { value: 1 },
	};

	Object.defineProperty(module, "GetterSharedStore", {
		get: () => GetterSharedStore,
		enumerable: true,
	});

	return module;
});

import * as SharedStoresModule from "@lanka_di/SharedStores";
import { ALankaSharedStore } from "../../../viewmodel/_abstractions/lanka-shared-store/ALankaSharedStore";
import { LankaSharedStoreLocator } from "./LankaSharedStoreLocator";

class ManualSharedStore extends ALankaSharedStore<{
	value: number;
}> {
	constructor() {
		super(() => ({ value: 99 }));
	}
}

describe("LankaSharedStoreLocator", () => {
	const mockedModule = SharedStoresModule as unknown as {
		FooSharedStore: { instances: number };
		AliasSharedStore: { instances: number };
		GetterSharedStore: { instances: number };
	};

	beforeEach(() => {
		mockedModule.FooSharedStore.instances = 0;
		mockedModule.AliasSharedStore.instances = 0;
		mockedModule.GetterSharedStore.instances = 0;
	});

	it("resolves shared store by export key via camelCase property", () => {
		const locator = new LankaSharedStoreLocator();
		const instance = locator.get("fooSharedStore");

		expect(instance).toBeInstanceOf(ALankaSharedStore);
		expect(mockedModule.FooSharedStore.instances).toBe(1);
	});

	/*
	 * There is no fallback to `Class.name`, here or in any other locator:
	 * minification drops that name too, so a lookup by it can only succeed where
	 * the export key already matched. Resolution is by EXPORT KEY, which is what
	 * the consumer writes in the barrel.
	 */

	it("resolves shared stores from getter-based exports", () => {
		const locator = new LankaSharedStoreLocator();
		const instance = locator.get("getterSharedStore");

		expect(instance.constructor.name).toBe("GetterSharedStore");
		expect(mockedModule.GetterSharedStore.instances).toBe(1);
	});

	it("caches created instances", () => {
		const locator = new LankaSharedStoreLocator();

		const first = locator.get("fooSharedStore");
		const second = locator.get("fooSharedStore");

		expect(first).toBe(second);
		expect(mockedModule.FooSharedStore.instances).toBe(1);
	});

	it("supports manual instance registration", () => {
		const locator = new LankaSharedStoreLocator();
		const instance = new ManualSharedStore();

		locator.registerInstance("ManualSharedStore", instance);

		const resolved = locator.get("manualSharedStore");

		expect(resolved).toBe(instance);
	});

	it("throws notFoundError when shared store is missing", () => {
		const locator = new LankaSharedStoreLocator();

		expect(() => locator.get("missingSharedStore")).toThrow(
			'SharedStore "MissingSharedStore" (accessed as "missingSharedStore") not found. ' +
				"Make sure the class extends ALankaSharedStore and is exported from @lanka_di/SharedStores.ts " +
				"or registered via registerSharedStore method.",
		);
	});
});
