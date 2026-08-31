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

/**
 * The memory tier has its own byte budget, enforced separately from the disk
 * one.
 *
 * It must be separate because `enforceBudget` returns immediately when there is
 * no persistent backend. On a platform with neither IndexedDB nor Cache Storage
 * nothing bounded the memory map, and a long session held every image it
 * touched. The same gap opened whenever a persistent write failed twice and the
 * record stayed resident.
 *
 * This grows with session length, not with collection size: nothing about a
 * single operation looks wrong, and the cost appears an hour in.
 */

const makeMemoryOnlyStore = (overrides: TBlobCacheConfigOverrides = {}) => {
	const env = makeEnvironment();
	const config = withBlobCacheConfig(overrides);
	// No candidates at all — the store degrades to the MEMORY tier.
	const store = new LankaBlobCacheStore(env, config, []);
	return {
		store,
		config,
		env,
	};
};

const makePersistentStore = (overrides: TBlobCacheConfigOverrides = {}) => {
	const env = makeEnvironment();
	const config = withBlobCacheConfig(overrides);
	const adapter = new FakeBlobStoreAdapter();
	const candidates: IBlobCacheBackendCandidate[] = [
		{ backend: BLOB_CACHE_BACKEND.INDEXED_DB, build: () => adapter },
	];
	const store = new LankaBlobCacheStore(env, config, candidates);
	return {
		store,
		adapter,
		config,
	};
};

describe("LankaBlobCacheStore — memory budget", () => {
	it("bounds the memory tier with no persistent backend at all", async () => {
		// 10 entries' worth of room, 200 written.
		const { store } = makeMemoryOnlyStore({
			maxMemoryBytes: 10 * 100,
			maxEntryBytes: 1000,
		});
		expect(await store.init()).toBe(BLOB_CACHE_BACKEND.MEMORY);

		for (let i = 0; i < 200; i += 1) {
			await store.put(`key-${i}`, makeBlob(100));
		}

		const { bytes, entries } = store.getMemoryDiagnostics();
		expect(bytes).toBeLessThanOrEqual(10 * 100);
		expect(entries).toBeLessThanOrEqual(10);
	});

	it("keeps the most recently used entries and drops the coldest", async () => {
		// The clock must move or "recently used" means nothing: with a frozen one
		// every record shares a last-used time, the sort degrades to insertion
		// order, and the test would pass for the wrong reason.
		const { store, env } = makeMemoryOnlyStore({
			maxMemoryBytes: 3 * 100,
			maxEntryBytes: 1000,
		});
		await store.init();

		await store.put("stale", makeBlob(100));
		env.clock.advance(1000);
		await store.put("revisited", makeBlob(100));

		// `peek` touches the last-used time, so the revisited entry becomes the
		// newest BY USE while the stale one stays oldest — exactly the distinction
		// eviction exists for.
		env.clock.advance(1000);
		store.peek("revisited");

		env.clock.advance(1000);
		await store.put("c", makeBlob(100));
		env.clock.advance(1000);
		await store.put("d", makeBlob(100));

		expect(store.peek("stale")).toBeNull();
		expect(store.peek("revisited")).not.toBeNull();
		expect(store.peek("d")).not.toBeNull();
	});

	it("evicting from memory does NOT drop the persistent copy", async () => {
		// The whole point of a separate budget: the entry is still cached, just no
		// longer resident. A shared eviction path would have thrown away disk
		// entries nowhere near the disk budget.
		const { store, adapter } = makePersistentStore({
			maxMemoryBytes: 2 * 100,
			maxEntryBytes: 1000,
			maxTotalBytes: 10 * 1024 * 1024,
		});
		await store.init();

		await store.put("first", makeBlob(100));
		await store.put("second", makeBlob(100));
		await store.put("third", makeBlob(100));

		expect(store.peek("first")).toBeNull();
		expect(adapter.records.has("first")).toBe(true);
		// …and a read brings it back from the backend.
		expect(await store.get("first")).not.toBeNull();
	});

	it("bounds memory even when every persistent write fails", async () => {
		// The second uncovered path: after a failed retry `put` returns early,
		// `enforceBudget` never runs, and the record is already memory-resident.
		const { store, adapter } = makePersistentStore({
			maxMemoryBytes: 5 * 100,
			maxEntryBytes: 1000,
		});
		await store.init();
		adapter.failAlways = true;

		for (let i = 0; i < 100; i += 1) {
			await store.put(`key-${i}`, makeBlob(100));
		}

		expect(store.getMemoryDiagnostics().bytes).toBeLessThanOrEqual(5 * 100);
	});

	it("bounds hydration too, so a large hydrateLimit cannot overshoot", async () => {
		const { store, adapter } = makePersistentStore({
			maxMemoryBytes: 4 * 100,
			maxEntryBytes: 1000,
			maxTotalBytes: 10 * 1024 * 1024,
		});
		await store.init();
		for (let i = 0; i < 50; i += 1) {
			await store.put(`key-${i}`, makeBlob(100));
		}
		await store.clear();
		for (let i = 0; i < 50; i += 1) {
			await adapter.put({
				key: `key-${i}`,
				blob: makeBlob(100),
				lastUsedAt: 1_000 + i,
				size: 100,
			});
		}

		await store.hydrateRecent(50);

		expect(store.getMemoryDiagnostics().bytes).toBeLessThanOrEqual(4 * 100);
	});

	it("stress: an hour of browsing never grows the memory tier", async () => {
		const { store } = makeMemoryOnlyStore({
			maxMemoryBytes: 64 * 1024,
			maxEntryBytes: 8 * 1024,
		});
		await store.init();

		// Five thousand distinct images — a long session across many screens.
		for (let i = 0; i < 5000; i += 1) {
			await store.put(`avatar-${i}`, makeBlob(1024));
		}

		const { bytes } = store.getMemoryDiagnostics();
		expect(bytes).toBeLessThanOrEqual(64 * 1024);
		// Unbounded, this would hold five megabytes.
		expect(bytes).toBeLessThan(5000 * 1024);
	});
});
