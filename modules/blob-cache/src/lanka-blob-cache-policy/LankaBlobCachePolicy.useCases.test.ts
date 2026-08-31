import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LankaBlobCachePolicy } from "./LankaBlobCachePolicy";
import { LankaBlobCacheStore } from "../store/lanka-blob-cache-store/LankaBlobCacheStore";
import { BLOB_CACHE_BACKEND } from "../store/blobCacheBackend";
import { LANKA_BLOB_CACHE_CONFIG } from "../lanka-blob-cache-config/lankaBlobCacheConfig";
import {
	BLOB_CACHE_URLS,
	flushBlobCache,
	makeEnvironment,
	makeImageResponse,
} from "../_testing/blobCacheTestDoubles";
import { makeBlobCachePolicy } from "../_testing/blobCachePolicyHarness";

/** Warming is fire-and-forget and internally queued; callers just enqueue each. */
const warmAll = (
	policy: { warmCache: (src: string | null) => void },
	sources: (string | null)[],
): void => {
	sources.forEach((src) => policy.warmCache(src));
};

/** End-to-end journeys, phrased the way a user would experience them. */
describe("LankaBlobCachePolicy — use cases", () => {
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		fetchMock = vi.fn(() => Promise.resolve(makeImageResponse()));
		vi.stubGlobal("fetch", fetchMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("first session then restart: second session paints from cache, no network", async () => {
		const first = makeBlobCachePolicy();
		await first.policy.hydrate();
		first.policy.getInitialSrc(BLOB_CACHE_URLS.S3);
		await flushBlobCache();

		// Restart: a brand-new policy over the SAME persistent adapter.
		const env = makeEnvironment();
		const store = new LankaBlobCacheStore(env, LANKA_BLOB_CACHE_CONFIG, [
			{
				backend: BLOB_CACHE_BACKEND.INDEXED_DB,
				build: () => first.adapter,
			},
		]);
		const restarted = new LankaBlobCachePolicy(env, LANKA_BLOB_CACHE_CONFIG, store);
		await restarted.hydrate();
		fetchMock.mockClear();

		expect(restarted.getInitialSrc(BLOB_CACHE_URLS.S3)).toMatch(/^blob:fake\//);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("restart with an empty store: falls back to the network, no crash", async () => {
		const { policy } = makeBlobCachePolicy();
		await policy.hydrate();

		expect(policy.getInitialSrc(BLOB_CACHE_URLS.S3)).toBe(BLOB_CACHE_URLS.S3);
	});

	it("gap photo replaced: the new URL is fetched, the old entry just ages out", async () => {
		const { policy, adapter } = makeBlobCachePolicy();
		policy.getInitialSrc(BLOB_CACHE_URLS.S3);
		await flushBlobCache();

		// Keys carry a uuid, so a re-upload is a different URL — no invalidation
		// logic is needed anywhere.
		policy.getInitialSrc(BLOB_CACHE_URLS.OTHER_S3);
		await flushBlobCache();

		expect(adapter.records.has(BLOB_CACHE_URLS.S3)).toBe(true);
		expect(adapter.records.has(BLOB_CACHE_URLS.OTHER_S3)).toBe(true);
	});

	it("participants list: 20 avatars produce 20 fetches and 20 entries", async () => {
		const { policy, adapter } = makeBlobCachePolicy();
		const avatars = Array.from(
			{ length: 20 },
			(_, index) => `${BLOB_CACHE_URLS.S3}?u=${index}`,
		);

		warmAll(policy, avatars);
		await flushBlobCache();

		expect(fetchMock).toHaveBeenCalledTimes(20);
		expect(adapter.records.size).toBe(20);
	});

	it("revisiting that list costs no requests at all", async () => {
		const { policy } = makeBlobCachePolicy();
		const avatars = Array.from({ length: 5 }, (_, index) => `${BLOB_CACHE_URLS.S3}?u=${index}`);
		warmAll(policy, avatars);
		await flushBlobCache();
		fetchMock.mockClear();

		warmAll(policy, avatars);
		avatars.forEach((src) => policy.getInitialSrc(src));

		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("a mixed list: only URLs that are not CORS-closed are stored", async () => {
		const { policy, adapter } = makeBlobCachePolicy({
			configOverrides: { corsBlockedOrigins: ["blocked.example"] },
		});

		warmAll(policy, [
			BLOB_CACHE_URLS.BLOCKED,
			BLOB_CACHE_URLS.S3,
			BLOB_CACHE_URLS.BLOCKED,
			BLOB_CACHE_URLS.OTHER_S3,
		]);
		await flushBlobCache();

		expect(adapter.records.size).toBe(2);
		expect(adapter.records.has(BLOB_CACHE_URLS.BLOCKED)).toBe(false);
	});

	it("offline session: every image still resolves to its network URL", async () => {
		fetchMock.mockRejectedValue(new Error("offline"));
		const { policy } = makeBlobCachePolicy({
			configOverrides: { corsBlockedOrigins: ["blocked.example"] },
		});

		const resolved = [BLOB_CACHE_URLS.S3, BLOB_CACHE_URLS.BLOCKED, BLOB_CACHE_URLS.BUNDLE].map(
			(src) => policy.getInitialSrc(src),
		);
		await flushBlobCache();

		expect(resolved).toEqual([
			BLOB_CACHE_URLS.S3,
			BLOB_CACHE_URLS.BLOCKED,
			BLOB_CACHE_URLS.BUNDLE,
		]);
	});

	it("logout then a different account: no face survives the switch", async () => {
		const { policy, adapter } = makeBlobCachePolicy();
		warmAll(policy, [BLOB_CACHE_URLS.S3, BLOB_CACHE_URLS.OTHER_S3]);
		await flushBlobCache();

		await policy.clear();

		expect(adapter.records.size).toBe(0);
	});
});
