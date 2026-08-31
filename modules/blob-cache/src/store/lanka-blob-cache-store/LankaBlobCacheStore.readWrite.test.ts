import { describe, expect, it } from "vitest";
import { LankaBlobCacheStore, type IBlobCacheBackendCandidate } from "./LankaBlobCacheStore";
import { BLOB_CACHE_BACKEND } from "../blobCacheBackend";
import {
	FakeBlobStoreAdapter,
	makeBlob,
	makeEnvironment,
	withBlobCacheConfig,
	type TBlobCacheConfigOverrides,
} from "../../_testing/blobCacheTestDoubles";

const candidate = (
	backend: (typeof BLOB_CACHE_BACKEND)[keyof typeof BLOB_CACHE_BACKEND],
	build: IBlobCacheBackendCandidate["build"],
): IBlobCacheBackendCandidate => ({
	backend,
	build,
});

const makeStore = (
	candidates: readonly IBlobCacheBackendCandidate[],
	configOverrides: TBlobCacheConfigOverrides = {},
) => {
	const env = makeEnvironment();
	const config = withBlobCacheConfig(configOverrides);
	const store = new LankaBlobCacheStore(env, config, candidates);
	return {
		store,
		env,
		config,
	};
};
/** Reading, writing, hydrating and expiring entries on a working backend. */
describe("LankaBlobCacheStore — reads and writes", () => {
	const withWorkingBackend = (configOverrides: TBlobCacheConfigOverrides = {}) => {
		const adapter = new FakeBlobStoreAdapter();
		const result = makeStore(
			[candidate(BLOB_CACHE_BACKEND.INDEXED_DB, () => adapter)],
			configOverrides,
		);
		return {
			...result,
			adapter,
		};
	};

	it("persists a blob and reads it back", async () => {
		const { store, adapter } = withWorkingBackend();
		await store.init();

		await store.put("a.webp", makeBlob(16));

		expect(adapter.records.has("a.webp")).toBe(true);
		expect((await store.get("a.webp"))?.size).toBe(16);
	});

	it("peek is memory-only and synchronous", async () => {
		const { store, adapter } = withWorkingBackend();
		await store.init();
		adapter.records.set("cold.webp", {
			key: "cold.webp",
			blob: makeBlob(),
			lastUsedAt: 1,
			size: 8,
		});

		// Present in the backend but not hydrated: peek must NOT see it, otherwise
		// callers would think a synchronous cache hit was available.
		expect(store.peek("cold.webp")).toBeNull();
	});

	it("hydrateRecent makes persisted entries visible to peek", async () => {
		const { store, adapter } = withWorkingBackend();
		await store.init();
		adapter.records.set("warm.webp", {
			key: "warm.webp",
			blob: makeBlob(),
			lastUsedAt: 5,
			size: 8,
		});

		const hydrated = await store.hydrateRecent(10);

		expect(hydrated).toBe(1);
		expect(store.peek("warm.webp")).not.toBeNull();
	});

	it("hydrateRecent respects its limit, newest first", async () => {
		const { store, adapter } = withWorkingBackend();
		await store.init();
		for (let index = 0; index < 5; index += 1) {
			adapter.records.set(`img-${index}`, {
				key: `img-${index}`,
				blob: makeBlob(),
				lastUsedAt: index,
				size: 8,
			});
		}

		await store.hydrateRecent(2);

		expect(store.peek("img-4")).not.toBeNull();
		expect(store.peek("img-3")).not.toBeNull();
		expect(store.peek("img-0")).toBeNull();
	});

	it("refuses entries larger than maxEntryBytes", async () => {
		const { store, adapter } = withWorkingBackend({
			maxEntryBytes: 10,
		});
		await store.init();

		await store.put("huge.webp", makeBlob(64));

		expect(adapter.records.size).toBe(0);
		expect(store.peek("huge.webp")).toBeNull();
	});

	it("drops expired entries on read", async () => {
		const { store, env } = withWorkingBackend({
			ttlMs: 100,
		});
		await store.init();
		await store.put("old.webp", makeBlob());

		env.clock.advance(1000);

		expect(store.peek("old.webp")).toBeNull();
		expect(await store.get("old.webp")).toBeNull();
	});

	it("touches lastUsedAt on read so LRU tracks usage, not insertion", async () => {
		const { store, env } = withWorkingBackend();
		await store.init();
		await store.put("a.webp", makeBlob());
		const before = store.peek("a.webp")!.lastUsedAt;

		env.clock.advance(500);
		const after = store.peek("a.webp")!.lastUsedAt;

		expect(after).toBeGreaterThan(before);
	});
});
