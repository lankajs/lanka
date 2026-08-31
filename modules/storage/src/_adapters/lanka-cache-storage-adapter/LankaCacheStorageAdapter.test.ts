import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LankaCacheStorageAdapter } from "./LankaCacheStorageAdapter";

describe("LankaCacheStorageAdapter", () => {
	let adapter: LankaCacheStorageAdapter;

	let mockCache: any;

	beforeEach(() => {
		mockCache = {
			put: vi.fn().mockResolvedValue(undefined),
			match: vi.fn(),
			delete: vi.fn().mockResolvedValue(true),
		};

		vi.stubGlobal("caches", {
			open: vi.fn().mockResolvedValue(mockCache),
			delete: vi.fn().mockResolvedValue(true),
		});

		adapter = new LankaCacheStorageAdapter("test-cache");
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should set item", async () => {
		await adapter.setItem("key1", "value1");
		expect(mockCache.put).toHaveBeenCalledWith("key1", expect.any(Response));
	});

	it("should get item", async () => {
		mockCache.match.mockResolvedValue(new Response("value2"));
		const value = await adapter.getItem("key2");
		expect(value).toBe("value2");
		expect(mockCache.match).toHaveBeenCalledWith("key2");
	});

	it("should return null for missing item", async () => {
		mockCache.match.mockResolvedValue(undefined);
		const value = await adapter.getItem("missing");
		expect(value).toBeNull();
	});

	it("should remove item", async () => {
		await adapter.removeItem("key3");
		expect(mockCache.delete).toHaveBeenCalledWith("key3");
	});

	it("should clear cache and reopen", async () => {
		const oldPromise = adapter["cachePromise"];
		await adapter.clear();
		expect(caches.delete).toHaveBeenCalledWith("test-cache");
		expect(adapter["cachePromise"]).not.toBe(oldPromise);
	});

	it("stress: rapid set and get", async () => {
		for (let i = 0; i < 1000; i++) {
			mockCache.match.mockResolvedValue(new Response(`v${i}`));
			await adapter.setItem(`k${i}`, `v${i}`);
			const val = await adapter.getItem(`k${i}`);
			expect(val).toBe(`v${i}`);
		}
	});
});
