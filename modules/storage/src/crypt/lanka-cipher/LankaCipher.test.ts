import { describe, it, expect, beforeEach } from "vitest";
import { LankaCipher } from "./LankaCipher";
import { createLankaCipher } from "../_factories/create-lanka-cipher/createLankaCipher";
import { ILankaStorageAdapter } from "../../_interfaces/ILankaStorageAdapter";

class MemoryStorageAdapter implements ILankaStorageAdapter {
	private store = new Map<string, string>();

	async setItem(key: string, value: string): Promise<void> {
		this.store.set(key, value);
	}
	async getItem(key: string): Promise<string | null> {
		return this.store.get(key) ?? null;
	}
	async removeItem(key: string): Promise<void> {
		this.store.delete(key);
	}
	async clear(): Promise<void> {
		this.store.clear();
	}
}

describe("LankaCipher (async-only)", () => {
	let service: LankaCipher;

	beforeEach(async () => {
		process.env.REACT_APP_IS_NEED_CRYPT = "true";
		service = await createLankaCipher(new MemoryStorageAdapter(), "secret");
	});

	it("should set and get item", async () => {
		await service.setItem("username", "Alice");
		const value = await service.getItem("username");
		expect(value).toBe("Alice");
	});

	it("should overwrite existing key", async () => {
		await service.setItem("user", "Bob");
		await service.setItem("user", "Charlie");
		const value = await service.getItem("user");
		expect(value).toBe("Charlie");
	});

	it("should remove item", async () => {
		await service.setItem("token", "12345");
		await service.removeItem("token");
		const value = await service.getItem("token");
		expect(value).toBeNull();
	});

	it("should clear storage", async () => {
		await service.setItem("k1", "v1");
		await service.setItem("k2", "v2");
		await service.clear();
		expect(await service.getItem("k1")).toBeNull();
		expect(await service.getItem("k2")).toBeNull();
	});

	it("should cache values after first decryption", async () => {
		await service.setItem("cacheKey", "cacheValue");
		const first = await service.getItem("cacheKey");
		const second = await service.getItem("cacheKey");
		expect(first).toBe("cacheValue");
		expect(second).toBe("cacheValue");
	});

	it("should throw error if key or value is empty", async () => {
		await expect(service.setItem("", "v")).rejects.toThrow();
		await expect(service.setItem("k", "")).rejects.toThrow();
		await expect(service.getItem("")).rejects.toThrow();
		await expect(service.removeItem("")).rejects.toThrow();
	});

	it("should work without encryption when disabled", async () => {
		process.env.REACT_APP_IS_NEED_CRYPT = "false";
		const plainService = await createLankaCipher(new MemoryStorageAdapter(), "secret");

		await plainService.setItem("plainKey", "plainValue");
		const value = await plainService.getItem("plainKey");
		expect(value).toBe("plainValue");
	});

	it("should cache hashed keys", async () => {
		const hashed1 = await (service as any).getHashedKey("abc");
		const hashed2 = await (service as any).getHashedKey("abc");

		expect(hashed1).toBe(hashed2);
	});

	it("should return null when getting non-existing key", async () => {
		const val = await service.getItem("doesNotExist");
		expect(val).toBeNull();
	});
});
