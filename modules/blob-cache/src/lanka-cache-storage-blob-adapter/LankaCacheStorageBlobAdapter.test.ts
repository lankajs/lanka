import { describe, expect, it, vi } from "vitest";
import { LankaCacheStorageBlobAdapter } from "./LankaCacheStorageBlobAdapter";
import { makeBlob } from "../_testing/blobCacheTestDoubles";

/**
 * The second rung, tested directly.
 *
 * jsdom has no Cache Storage, so it is faked. What is worth pinning is not "does
 * it store bytes" but the two properties that make this adapter different from
 * the IndexedDB one: `caches.open` must be LAZY — opening in the constructor
 * would throw in an insecure context — and the last-used time must survive a
 * round trip through response headers, because Cache Storage stores responses
 * rather than records.
 */

const makeFakeCacheStorage = (options: { failOpen?: boolean } = {}) => {
	const entries = new Map<string, Response>();
	let openCalls = 0;
	let deleteCacheCalls = 0;

	const cache = {
		// Real Cache Storage hands out a fresh Response per match, and a body is read
		// once: the fake must clone or the second read would throw.
		match: (url: string) => Promise.resolve(entries.get(url)?.clone()),
		put: (url: string, response: Response) => {
			entries.set(url, response);
			return Promise.resolve();
		},
		delete: (url: string) => {
			entries.delete(url);
			return Promise.resolve(true);
		},
		keys: () => Promise.resolve([...entries.keys()].map((url) => ({ url }) as Request)),
	} as unknown as Cache;

	const cacheStorage = {
		open: () => {
			openCalls += 1;
			if (options.failOpen) {
				return Promise.reject(new Error("insecure context"));
			}
			return Promise.resolve(cache);
		},
		delete: () => {
			deleteCacheCalls += 1;
			entries.clear();
			return Promise.resolve(true);
		},
	} as unknown as CacheStorage;

	return {
		cacheStorage,
		entries,
		openCalls: () => openCalls,
		deleteCacheCalls: () => deleteCacheCalls,
	};
};

const now = () => 1_700_000_000_000;

describe("LankaCacheStorageBlobAdapter", () => {
	it("does not touch caches.open at construction time", () => {
		const fake = makeFakeCacheStorage();

		new LankaCacheStorageBlobAdapter(fake.cacheStorage, "bucket", now);

		// An adapter that opens the store eagerly would throw here in an insecure
		// context, taking the whole chain down with it.
		expect(fake.openCalls()).toBe(0);
	});

	it("round-trips a blob record", async () => {
		const fake = makeFakeCacheStorage();
		const adapter = new LankaCacheStorageBlobAdapter(fake.cacheStorage, "bucket", now);

		await adapter.put({
			key: "https://cdn/a.webp",
			blob: makeBlob(24),
			lastUsedAt: 42,
			size: 24,
		});
		const record = await adapter.get("https://cdn/a.webp");

		expect(record?.key).toBe("https://cdn/a.webp");
		expect(record?.size).toBe(24);
	});

	it("preserves lastUsedAt across the response-header round trip", async () => {
		const fake = makeFakeCacheStorage();
		const adapter = new LankaCacheStorageBlobAdapter(fake.cacheStorage, "bucket", now);

		await adapter.put({
			key: "a",
			blob: makeBlob(),
			lastUsedAt: 12345,
			size: 8,
		});

		// Without this every entry would look brand new and eviction would pick
		// victims at random.
		expect((await adapter.get("a"))?.lastUsedAt).toBe(12345);
	});

	it("falls back to the clock when the header is missing or unparseable", async () => {
		const fake = makeFakeCacheStorage();
		const adapter = new LankaCacheStorageBlobAdapter(fake.cacheStorage, "bucket", now);
		// An entry written by an older build, with no metadata header.
		fake.entries.set("https://image-cache.invalid/legacy", new Response(makeBlob()));

		expect((await adapter.get("legacy"))?.lastUsedAt).toBe(now());
	});

	it("returns null for a missing key", async () => {
		const fake = makeFakeCacheStorage();
		const adapter = new LankaCacheStorageBlobAdapter(fake.cacheStorage, "bucket", now);

		expect(await adapter.get("nope")).toBeNull();
	});

	it("encodes opaque keys into a URL and decodes them back", async () => {
		const fake = makeFakeCacheStorage();
		const adapter = new LankaCacheStorageBlobAdapter(fake.cacheStorage, "bucket", now);
		const key = "https://cdn/a b?x=1&y=2";

		await adapter.put({
			key,
			blob: makeBlob(),
			lastUsedAt: 1,
			size: 8,
		});

		// Cache Storage keys must be URLs, so an image URL with a query string has to
		// survive being embedded in another URL's path.
		expect((await adapter.listByAge())[0]?.key).toBe(key);
	});

	it("deletes an entry", async () => {
		const fake = makeFakeCacheStorage();
		const adapter = new LankaCacheStorageBlobAdapter(fake.cacheStorage, "bucket", now);
		await adapter.put({
			key: "a",
			blob: makeBlob(),
			lastUsedAt: 1,
			size: 8,
		});

		await adapter.delete("a");

		expect(await adapter.get("a")).toBeNull();
	});

	it("lists entries oldest first, so callers evict from the head", async () => {
		const fake = makeFakeCacheStorage();
		const adapter = new LankaCacheStorageBlobAdapter(fake.cacheStorage, "bucket", now);
		await adapter.put({
			key: "new",
			blob: makeBlob(),
			lastUsedAt: 300,
			size: 8,
		});
		await adapter.put({
			key: "old",
			blob: makeBlob(),
			lastUsedAt: 100,
			size: 8,
		});

		const keys = (await adapter.listByAge()).map((entry) => entry.key);

		expect(keys).toEqual(["old", "new"]);
	});

	it("clear drops the whole bucket", async () => {
		const fake = makeFakeCacheStorage();
		const adapter = new LankaCacheStorageBlobAdapter(fake.cacheStorage, "bucket", now);
		await adapter.put({
			key: "a",
			blob: makeBlob(),
			lastUsedAt: 1,
			size: 8,
		});

		await adapter.clear();

		expect(fake.deleteCacheCalls()).toBe(1);
		expect(await adapter.listByAge()).toHaveLength(0);
	});

	it("propagates an open failure so the chain can step down a rung", async () => {
		const fake = makeFakeCacheStorage({ failOpen: true });
		const adapter = new LankaCacheStorageBlobAdapter(fake.cacheStorage, "bucket", now);

		// Rejecting is correct: the probe treats the rung as dead and moves to
		// memory rather than silently losing writes.
		await expect(adapter.get("a")).rejects.toThrow("insecure context");
	});

	it("is usable as the store's level-2 backend end to end", async () => {
		const fake = makeFakeCacheStorage();
		const adapter = new LankaCacheStorageBlobAdapter(fake.cacheStorage, "bucket", vi.fn(now));

		await adapter.put({
			key: "k",
			blob: makeBlob(),
			lastUsedAt: now(),
			size: 8,
		});

		expect(await adapter.get("k")).not.toBeNull();
		expect(await adapter.listByAge()).toHaveLength(1);
	});
});
