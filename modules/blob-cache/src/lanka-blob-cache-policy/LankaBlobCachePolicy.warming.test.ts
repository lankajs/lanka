import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	BLOB_CACHE_URLS,
	flushBlobCache,
	makeErrorResponse,
	makeHtmlResponse,
	makeImageResponse,
} from "../_testing/blobCacheTestDoubles";
import { makeBlobCachePolicy } from "../_testing/blobCachePolicyHarness";

/** How bytes are fetched and stored — and what must never be stored. */
describe("LankaBlobCachePolicy — warming", () => {
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		fetchMock = vi.fn(() => Promise.resolve(makeImageResponse()));
		vi.stubGlobal("fetch", fetchMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("fetches once and stores the blob", async () => {
		const { policy, adapter } = makeBlobCachePolicy();

		policy.warmCache(BLOB_CACHE_URLS.S3);
		await flushBlobCache();

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(adapter.records.has(BLOB_CACHE_URLS.S3)).toBe(true);
	});

	it("uses force-cache so a warm HTTP cache costs nothing", async () => {
		const { policy } = makeBlobCachePolicy();

		policy.warmCache(BLOB_CACHE_URLS.S3);
		await flushBlobCache();

		expect(fetchMock).toHaveBeenCalledWith(BLOB_CACHE_URLS.S3, {
			cache: "force-cache",
		});
	});

	it("deduplicates parallel requests for the same URL", async () => {
		const { policy } = makeBlobCachePolicy();

		policy.warmCache(BLOB_CACHE_URLS.S3);
		policy.warmCache(BLOB_CACHE_URLS.S3);
		policy.warmCache(BLOB_CACHE_URLS.S3);
		await flushBlobCache();

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("skips null and undefined", () => {
		const { policy } = makeBlobCachePolicy();

		policy.warmCache(null);
		policy.warmCache(undefined);

		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("skips already cached URLs", async () => {
		const { policy } = makeBlobCachePolicy();
		policy.warmCache(BLOB_CACHE_URLS.S3);
		await flushBlobCache();
		fetchMock.mockClear();

		policy.warmCache(BLOB_CACHE_URLS.S3);
		await flushBlobCache();

		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("does not retry a failed URL within the session", async () => {
		fetchMock.mockResolvedValue(makeErrorResponse());
		const { policy } = makeBlobCachePolicy();

		policy.warmCache(BLOB_CACHE_URLS.S3);
		await flushBlobCache();
		policy.warmCache(BLOB_CACHE_URLS.S3);
		await flushBlobCache();

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("keeps serving the network URL after a failed warm", async () => {
		fetchMock.mockResolvedValue(makeErrorResponse(500));
		const { policy } = makeBlobCachePolicy();

		policy.warmCache(BLOB_CACHE_URLS.S3);
		await flushBlobCache();

		expect(policy.getInitialSrc(BLOB_CACHE_URLS.S3)).toBe(BLOB_CACHE_URLS.S3);
	});

	it("rejects a non-image response instead of caching an error page", async () => {
		fetchMock.mockResolvedValue(makeHtmlResponse());
		const { policy, adapter } = makeBlobCachePolicy();

		policy.warmCache(BLOB_CACHE_URLS.S3);
		await flushBlobCache();

		// HTML from a captive portal or a sign-in redirect must not be cached as an
		// image: it would render as a broken image until the entry's TTL expires.
		expect(adapter.records.size).toBe(0);
	});

	it("survives a fetch that throws (offline)", async () => {
		fetchMock.mockRejectedValue(new Error("network down"));
		const { policy } = makeBlobCachePolicy();

		expect(() => policy.warmCache(BLOB_CACHE_URLS.S3)).not.toThrow();
		await expect(flushBlobCache()).resolves.toBeUndefined();
	});

	/**
	 * REGRESSION: warming fetched immediately and is called once per rendered
	 * image, so a fifty-row list put fifty requests on the wire AHEAD of the
	 * screen's own data. The cap now lives in warming itself — the path a real
	 * application takes; a separate batching helper existed and nothing called it.
	 */
	it("caps concurrent fetches, however many images render at once", async () => {
		let inFlight = 0;
		let maxInFlight = 0;
		fetchMock.mockImplementation(() => {
			inFlight += 1;
			maxInFlight = Math.max(maxInFlight, inFlight);
			return Promise.resolve().then(() => {
				inFlight -= 1;
				return makeImageResponse();
			});
		});
		const { policy } = makeBlobCachePolicy({
			configOverrides: { maxConcurrent: 2 },
		});

		Array.from({ length: 12 }, (_, index) => `${BLOB_CACHE_URLS.S3}?v=${index}`).forEach(
			(src) => policy.warmCache(src),
		);
		await flushBlobCache();

		expect(maxInFlight).toBeLessThanOrEqual(2);
	});

	it("still fetches every queued image, not just the first batch", async () => {
		const { policy, adapter } = makeBlobCachePolicy({
			configOverrides: { maxConcurrent: 2 },
		});

		Array.from({ length: 7 }, (_, index) => `${BLOB_CACHE_URLS.S3}?v=${index}`).forEach((src) =>
			policy.warmCache(src),
		);
		await flushBlobCache();

		// A freed slot must admit the next queued image, or a long list stalls after
		// the first batch.
		expect(adapter.records.size).toBe(7);
	});

	it("does not queue the same URL twice while it waits for a slot", async () => {
		const { policy } = makeBlobCachePolicy({
			configOverrides: { maxConcurrent: 1 },
		});

		policy.warmCache(BLOB_CACHE_URLS.S3);
		policy.warmCache(BLOB_CACHE_URLS.OTHER_S3);
		policy.warmCache(BLOB_CACHE_URLS.OTHER_S3);
		await flushBlobCache();

		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("drops queued work on clear, so a wiped store is not repopulated", async () => {
		const { policy, adapter } = makeBlobCachePolicy({
			configOverrides: { maxConcurrent: 1 },
		});

		policy.warmCache(BLOB_CACHE_URLS.S3);
		policy.warmCache(BLOB_CACHE_URLS.OTHER_S3);
		await policy.clear();
		await flushBlobCache();

		// Everything still queued belongs to the session being closed.
		expect(adapter.records.has(BLOB_CACHE_URLS.OTHER_S3)).toBe(false);
	});
});

/**
 * A policy told EXPLICITLY about an unreachable host.
 *
 * The list is empty by default: the package knows no "bad" domain and must not.
 * The tests below are about the blocking mechanism, so they declare it
 * themselves — as an application will.
 */
const makeBlockingPolicy = () =>
	makeBlobCachePolicy({ configOverrides: { corsBlockedOrigins: ["blocked.example"] } });

describe("LankaBlobCachePolicy — CORS-closed hosts", () => {
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		fetchMock = vi.fn(() => Promise.resolve(makeImageResponse()));
		vi.stubGlobal("fetch", fetchMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("serves such a URL untouched", () => {
		const { policy } = makeBlockingPolicy();

		// `<img>` renders them fine — rendering needs no CORS; only `fetch` is
		// refused, so their bytes are never ours to store.
		expect(policy.getInitialSrc(BLOB_CACHE_URLS.BLOCKED)).toBe(BLOB_CACHE_URLS.BLOCKED);
	});

	it("does not fetch from a closed host", async () => {
		const { policy } = makeBlockingPolicy();

		policy.warmCache(BLOB_CACHE_URLS.BLOCKED);
		await flushBlobCache();

		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("stores nothing for it", async () => {
		const { policy, adapter } = makeBlockingPolicy();

		policy.warmCache(BLOB_CACHE_URLS.BLOCKED);
		await flushBlobCache();

		expect(adapter.records.size).toBe(0);
	});

	it("returns the same URL on every resolve, so the `<img>` never swaps", () => {
		const { policy } = makeBlockingPolicy();

		expect(policy.getInitialSrc(BLOB_CACHE_URLS.BLOCKED)).toBe(
			policy.getInitialSrc(BLOB_CACHE_URLS.BLOCKED),
		);
	});

	it("same-origin build assets are cached like any others", async () => {
		const { policy, adapter } = makeBlockingPolicy();

		policy.warmCache(BLOB_CACHE_URLS.BUNDLE);
		await flushBlobCache();

		// Small and immutable, but caching them removes one more source of
		// re-decode flicker on a slow device.
		expect(adapter.records.has(BLOB_CACHE_URLS.BUNDLE)).toBe(true);
	});
});
