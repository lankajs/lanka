import { describe, expect, it } from "vitest";
import { LankaBlobCacheStore, type IBlobCacheBackendCandidate } from "./LankaBlobCacheStore";
import { BLOB_CACHE_BACKEND } from "../blobCacheBackend";
import {
	FakeBlobStoreAdapter,
	HangingBlobStoreAdapter,
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
/** Which storage rung a device ends up on, and how it steps down. */
describe("LankaBlobCacheStore — fallback chain", () => {
	it("picks IndexedDB when it works", async () => {
		const idb = new FakeBlobStoreAdapter();
		const { store } = makeStore([
			candidate(BLOB_CACHE_BACKEND.INDEXED_DB, () => idb),
			candidate(BLOB_CACHE_BACKEND.CACHE_STORAGE, () => new FakeBlobStoreAdapter()),
		]);

		expect(await store.init()).toBe(BLOB_CACHE_BACKEND.INDEXED_DB);
	});

	it("falls through to Cache Storage when IndexedDB is absent", async () => {
		const cacheStorage = new FakeBlobStoreAdapter();
		const { store } = makeStore([
			candidate(BLOB_CACHE_BACKEND.INDEXED_DB, () => null),
			candidate(BLOB_CACHE_BACKEND.CACHE_STORAGE, () => cacheStorage),
		]);

		expect(await store.init()).toBe(BLOB_CACHE_BACKEND.CACHE_STORAGE);
	});

	it("falls through when a builder THROWS, not just returns null", async () => {
		// The pre-existing LankaCacheStorageAdapter calls `caches.open` in its
		// constructor, which throws in an insecure context. One rung must not take
		// the chain down.
		const cacheStorage = new FakeBlobStoreAdapter();
		const { store } = makeStore([
			candidate(BLOB_CACHE_BACKEND.INDEXED_DB, () => {
				throw new Error("insecure context");
			}),
			candidate(BLOB_CACHE_BACKEND.CACHE_STORAGE, () => cacheStorage),
		]);

		expect(await store.init()).toBe(BLOB_CACHE_BACKEND.CACHE_STORAGE);
	});

	it("falls through when a backend exists but fails its probe", async () => {
		const broken = new FakeBlobStoreAdapter();
		broken.failAlways = true;
		const working = new FakeBlobStoreAdapter();
		const { store } = makeStore([
			candidate(BLOB_CACHE_BACKEND.INDEXED_DB, () => broken),
			candidate(BLOB_CACHE_BACKEND.CACHE_STORAGE, () => working),
		]);

		// Feature detection alone would have accepted the broken store.
		expect(await store.init()).toBe(BLOB_CACHE_BACKEND.CACHE_STORAGE);
	});

	it("times out a backend that never settles, then falls through", async () => {
		// iOS private mode: `indexedDB.open()` neither resolves nor rejects. Without
		// the timeout the whole cache would hang behind an unresolved promise.
		const working = new FakeBlobStoreAdapter();
		const { store } = makeStore(
			[
				candidate(BLOB_CACHE_BACKEND.INDEXED_DB, () => new HangingBlobStoreAdapter()),
				candidate(BLOB_CACHE_BACKEND.CACHE_STORAGE, () => working),
			],
			{
				probeTimeoutMs: 20,
			},
		);

		expect(await store.init()).toBe(BLOB_CACHE_BACKEND.CACHE_STORAGE);
	});

	it("degrades to memory when every backend fails", async () => {
		const { store } = makeStore([
			candidate(BLOB_CACHE_BACKEND.INDEXED_DB, () => null),
			candidate(BLOB_CACHE_BACKEND.CACHE_STORAGE, () => null),
		]);

		expect(await store.init()).toBe(BLOB_CACHE_BACKEND.MEMORY);
	});

	it("still serves reads and writes on the memory rung", async () => {
		const { store } = makeStore([]);
		await store.init();

		await store.put("a.webp", makeBlob());

		expect(store.peek("a.webp")).not.toBeNull();
	});

	it("resolves the chain only once", async () => {
		let builds = 0;
		const { store } = makeStore([
			candidate(BLOB_CACHE_BACKEND.INDEXED_DB, () => {
				builds += 1;
				return new FakeBlobStoreAdapter();
			}),
		]);

		await store.init();
		await store.init();
		await store.init();

		expect(builds).toBe(1);
	});
});
