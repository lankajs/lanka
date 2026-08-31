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
/** Staying inside the platform byte budget without ever surfacing an error. */
describe("LankaBlobCacheStore — quota and eviction", () => {
	const withAdapter = (configOverrides: TBlobCacheConfigOverrides = {}) => {
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

	it("evicts the oldest entries once the byte budget is exceeded", async () => {
		const { store, adapter, env } = withAdapter({
			maxTotalBytes: 30,
			maxEntryBytes: 100,
			evictionRatio: 0.5,
		});
		await store.init();

		await store.put("oldest", makeBlob(16));
		env.clock.advance(10);
		await store.put("newest", makeBlob(16));

		expect(adapter.records.has("oldest")).toBe(false);
		expect(adapter.records.has("newest")).toBe(true);
	});

	it("makes room and retries once when a write is rejected (quota)", async () => {
		const { store, adapter, env } = withAdapter({
			maxEntryBytes: 100,
		});
		await store.init();
		await store.put("victim", makeBlob(16));
		env.clock.advance(10);

		adapter.failNextPut = new Error("QuotaExceededError");
		await store.put("wanted", makeBlob(16));

		// The retry succeeded, and it succeeded because room was made.
		expect(adapter.records.has("wanted")).toBe(true);
		expect(adapter.records.has("victim")).toBe(false);
	});

	it("gives up quietly when the retry also fails", async () => {
		const { store, adapter } = withAdapter();
		await store.init();
		adapter.failAlways = true;

		// The image still renders from network; it just will not be persisted. This
		// must never surface as an error.
		await expect(store.put("a", makeBlob())).resolves.toBeUndefined();
		expect(store.peek("a")).not.toBeNull();
	});

	it("survives a backend that breaks mid-session", async () => {
		const { store, adapter } = withAdapter();
		await store.init();
		await store.put("a", makeBlob());
		adapter.failAlways = true;

		await expect(store.get("b")).resolves.toBeNull();
		await expect(store.clear()).resolves.toBeUndefined();
	});

	it("clear wipes both memory and the backend", async () => {
		const { store, adapter } = withAdapter();
		await store.init();
		await store.put("a", makeBlob());

		await store.clear();

		expect(store.peek("a")).toBeNull();
		expect(adapter.records.size).toBe(0);
	});
});
