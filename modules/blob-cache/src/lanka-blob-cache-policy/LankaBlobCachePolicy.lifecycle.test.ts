import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BLOB_CACHE_BACKEND } from "../store/blobCacheBackend";
import {
	BLOB_CACHE_URLS,
	flushBlobCache,
	makeImageResponse,
} from "../_testing/blobCacheTestDoubles";
import { makeBlobCachePolicy } from "../_testing/blobCachePolicyHarness";

/** Hydration, teardown and the privacy obligations around cached faces. */
describe("LankaBlobCachePolicy — hydration", () => {
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		fetchMock = vi.fn(() => Promise.resolve(makeImageResponse()));
		vi.stubGlobal("fetch", fetchMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("works with no persistent backend at all", async () => {
		const { policy, store } = makeBlobCachePolicy({
			backendWorks: false,
		});
		await policy.hydrate();

		policy.getInitialSrc(BLOB_CACHE_URLS.S3);
		await flushBlobCache();

		expect(store.getBackend()).toBe(BLOB_CACHE_BACKEND.MEMORY);
		// Memory-only is exactly the pre-existing behaviour: within a session the
		// second mount is still instant.
		expect(policy.getInitialSrc(BLOB_CACHE_URLS.S3)).toMatch(/^blob:fake\//);
	});

	it("resolves even when there is nothing to hydrate", async () => {
		const { policy } = makeBlobCachePolicy({ backendWorks: false });

		await expect(policy.hydrate()).resolves.toBeUndefined();
	});

	it("runs only once", async () => {
		const { policy, store } = makeBlobCachePolicy();
		const spy = vi.spyOn(store, "hydrateRecent");

		await policy.hydrate();
		await policy.hydrate();

		expect(spy).toHaveBeenCalledTimes(1);
	});

	it("shares one promise across concurrent callers", async () => {
		const { policy, store } = makeBlobCachePolicy();
		const spy = vi.spyOn(store, "hydrateRecent");

		await Promise.all([policy.hydrate(), policy.hydrate(), policy.hydrate()]);

		expect(spy).toHaveBeenCalledTimes(1);
	});

	it("reports the resolved backend, for the dev log", async () => {
		const { policy } = makeBlobCachePolicy();

		await policy.hydrate();

		expect(policy.getBackend()).toBe(BLOB_CACHE_BACKEND.INDEXED_DB);
	});
});

describe("LankaBlobCachePolicy — privacy and teardown", () => {
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		fetchMock = vi.fn(() => Promise.resolve(makeImageResponse()));
		vi.stubGlobal("fetch", fetchMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("clear wipes the store and revokes every object URL", async () => {
		const { policy, adapter, env } = makeBlobCachePolicy();
		policy.getInitialSrc(BLOB_CACHE_URLS.S3);
		await flushBlobCache();
		policy.getInitialSrc(BLOB_CACHE_URLS.S3);

		await policy.clear();

		// Logout on a shared device must not leave the previous account's faces
		// behind, nor leak the blobs they pinned.
		expect(adapter.records.size).toBe(0);
		expect(env.urls.live()).toHaveLength(0);
	});

	it("re-fetches after clear instead of serving a revoked URL", async () => {
		const { policy } = makeBlobCachePolicy();
		policy.getInitialSrc(BLOB_CACHE_URLS.S3);
		await flushBlobCache();
		await policy.clear();
		fetchMock.mockClear();

		expect(policy.getInitialSrc(BLOB_CACHE_URLS.S3)).toBe(BLOB_CACHE_URLS.S3);
		await flushBlobCache();

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("clear also forgets failed URLs, so a new session may retry them", async () => {
		fetchMock.mockRejectedValueOnce(new Error("offline"));
		const { policy } = makeBlobCachePolicy();
		policy.warmCache(BLOB_CACHE_URLS.S3);
		await flushBlobCache();

		await policy.clear();
		fetchMock.mockClear();
		policy.warmCache(BLOB_CACHE_URLS.S3);
		await flushBlobCache();

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("releaseObjectUrls frees memory without dropping the persisted blobs", async () => {
		const { policy, adapter, env } = makeBlobCachePolicy();
		policy.getInitialSrc(BLOB_CACHE_URLS.S3);
		await flushBlobCache();
		policy.getInitialSrc(BLOB_CACHE_URLS.S3);

		policy.releaseObjectUrls();

		expect(env.urls.live()).toHaveLength(0);
		expect(adapter.records.has(BLOB_CACHE_URLS.S3)).toBe(true);
	});

	it("mints a fresh object URL after a release", async () => {
		const { policy, env } = makeBlobCachePolicy();
		policy.getInitialSrc(BLOB_CACHE_URLS.S3);
		await flushBlobCache();
		policy.getInitialSrc(BLOB_CACHE_URLS.S3);

		policy.releaseObjectUrls();
		const revived = policy.getInitialSrc(BLOB_CACHE_URLS.S3);

		// Serving a revoked URL would render a broken image; a new one must be made.
		expect(revived).toMatch(/^blob:fake\//);
		expect(env.urls.live()).toHaveLength(1);
	});

	it("release is idempotent", async () => {
		const { policy } = makeBlobCachePolicy();
		policy.getInitialSrc(BLOB_CACHE_URLS.S3);
		await flushBlobCache();
		policy.getInitialSrc(BLOB_CACHE_URLS.S3);

		policy.releaseObjectUrls();

		expect(() => policy.releaseObjectUrls()).not.toThrow();
	});
});
