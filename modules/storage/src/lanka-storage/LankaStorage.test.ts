import { describe, it, expect, beforeEach } from "vitest";
import { lankaStorage } from "./LankaStorage";

class MockStorageAdapter {
	private store = new Map<string, string>();
	async setItem(key: string, value: string) {
		this.store.set(key, value);
	}
	async getItem(key: string) {
		return this.store.get(key) ?? null;
	}
	async removeItem(key: string) {
		this.store.delete(key);
	}
	async clear() {
		this.store.clear();
	}
	setItemSync(key: string, value: string) {
		this.store.set(key, value);
	}
	getItemSync(key: string) {
		return this.store.get(key) ?? null;
	}
	removeItemSync(key: string) {
		this.store.delete(key);
	}
	clearSync() {
		this.store.clear();
	}
}

describe("LankaStorage", () => {
	beforeEach(() => {
		(lankaStorage as unknown as Record<string, unknown>).localStorageHandler =
			new MockStorageAdapter();

		(lankaStorage as unknown as Record<string, unknown>).sessionStorageHandler =
			new MockStorageAdapter();

		(lankaStorage as unknown as Record<string, unknown>).cacheStorageHandler =
			new MockStorageAdapter();

		// @ts-expect-error: clear private memory cache
		lankaStorage.localMemoryCache.clear();

		// @ts-expect-error: clear private memory cache
		lankaStorage.sessionMemoryCache.clear();

		// @ts-expect-error: clear private memory cache
		lankaStorage.cacheMemoryCache.clear();
	});

	it("should set and get local values async", async () => {
		await lankaStorage.setLocal("k1", "v1");
		const val = await lankaStorage.getLocal("k1");
		expect(val).toBe("v1");
	});

	it("should remove local values async", async () => {
		await lankaStorage.setLocal("k2", "v2");
		await lankaStorage.removeLocal("k2");
		const val = await lankaStorage.getLocal("k2");
		expect(val).toBeNull();
	});

	it("should set and get local values sync", () => {
		lankaStorage.setLocalSync("k3", "v3");
		const val = lankaStorage.getLocalSync("k3");
		expect(val).toBe("v3");
		lankaStorage.removeLocalSync("k3");
		const val2 = lankaStorage.getLocalSync("k3");
		expect(val2).toBeNull();
	});

	it("should set and get session values async", async () => {
		await lankaStorage.setSession("s1", "v1");
		const val = await lankaStorage.getSession("s1");
		expect(val).toBe("v1");
	});

	it("should set and get session values sync", () => {
		lankaStorage.setSessionSync("s2", "v2");
		const val = lankaStorage.getSessionSync("s2");
		expect(val).toBe("v2");
		lankaStorage.removeSessionSync("s2");
		const val2 = lankaStorage.getSessionSync("s2");
		expect(val2).toBeNull();
	});

	it("should set and get cache values", async () => {
		await lankaStorage.setCache("c1", "v1");
		const val = await lankaStorage.getCache("c1");
		expect(val).toBe("v1");
		await lankaStorage.removeCache("c1");
		const val2 = await lankaStorage.getCache("c1");
		expect(val2).toBeNull();
	});

	it("throws when the underlying handler has no sync methods", () => {
		class AsyncOnlyAdapter {
			async setItem() {}
			async getItem() {
				return null;
			}
			async removeItem() {}
			async clear() {}
		}

		// @ts-expect-error: test override private static handler
		lankaStorage.localStorageHandler = new AsyncOnlyAdapter();
		// @ts-expect-error: ensure getLocalSync misses the memory cache and reaches the handler
		lankaStorage.localMemoryCache.clear();

		expect(() => lankaStorage.setLocalSync("nosync", "v")).toThrow(
			"Sync methods are not available",
		);
		expect(() => lankaStorage.getLocalSync("nosync")).toThrow("Sync methods are not available");
		expect(() => lankaStorage.removeLocalSync("nosync")).toThrow(
			"Sync methods are not available",
		);
	});

	it("stress: repeated set/get local values", async () => {
		for (let i = 0; i < 1000; i++) {
			await lankaStorage.setLocal(`k${i}`, `v${i}`);
			const val = await lankaStorage.getLocal(`k${i}`);
			expect(val).toBe(`v${i}`);
		}
	});

	it("stress: repeated set/get session values sync", () => {
		for (let i = 0; i < 1000; i++) {
			lankaStorage.setSessionSync(`s${i}`, `v${i}`);
			const val = lankaStorage.getSessionSync(`s${i}`);
			expect(val).toBe(`v${i}`);
		}
	});
});
