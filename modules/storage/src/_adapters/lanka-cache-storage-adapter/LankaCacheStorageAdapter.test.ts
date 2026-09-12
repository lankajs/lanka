import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LankaCacheStorageAdapter } from "./LankaCacheStorageAdapter";
import { lankaStorageAdapterConformance } from "@lankajs/tool-testing/lankaStorageAdapterConformance";

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

/**
 * A Cache Storage that actually stores, for the family's shared assertions.
 *
 * The mocks above are scripted: `match` answers whatever the scene told it to,
 * which is right for "does it call `put` with a `Response`" and useless for "does
 * an empty string survive the round trip". The port's clauses are about the
 * round trip, so they need a cache that remembers.
 *
 * Installed inside `create` rather than in a hook: this file's other suite stubs
 * the same global per test, and a module-level hook here would reach into it.
 *
 * Where this double is WEAKER than the engine: a real Cache Storage resolves a
 * key as a URL, so clause 11 — a key used as it was given — is the one scene it
 * cannot honestly answer for. A `Map` keeps `"with space"` verbatim and a browser
 * may not. The clause stands for the adapters that can be measured against a real
 * engine; this one is measured against the API it calls.
 */
const inMemoryCacheStorage = () => {
	const stores = new Map<string, Map<string, string>>();
	const storeFor = (name: string) => {
		const existing = stores.get(name);
		if (existing) return existing;

		const created = new Map<string, string>();
		stores.set(name, created);
		return created;
	};

	return {
		open: (name: string) => {
			const store = storeFor(name);

			return Promise.resolve({
				put: async (key: string, response: Response) => {
					store.set(key, await response.text());
				},
				match: (key: string) =>
					Promise.resolve(store.has(key) ? new Response(store.get(key)) : undefined),
				delete: (key: string) => Promise.resolve(store.delete(key)),
			});
		},
		delete: (name: string) => Promise.resolve(stores.delete(name)),
	};
};

lankaStorageAdapterConformance({
	vendor: "LankaCacheStorageAdapter",
	create: () => {
		vi.stubGlobal("caches", inMemoryCacheStorage());
		return new LankaCacheStorageAdapter("lanka-conformance");
	},
});
