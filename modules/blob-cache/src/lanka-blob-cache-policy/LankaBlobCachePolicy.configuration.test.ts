import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeBlobCachePolicy } from "../_testing/blobCachePolicyHarness";
import {
	BLOB_CACHE_URLS,
	flushBlobCache,
	makeImageResponse,
} from "../_testing/blobCacheTestDoubles";

/**
 * What the application decides and what the package decides.
 *
 * What is checked is default behaviour rather than intent: an empty
 * configuration must neither fetch on its own, nor refuse to cache somebody's
 * domain, nor agree to store HTML disguised as an image.
 */
describe("LankaBlobCachePolicy — defaults", () => {
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		fetchMock = vi.fn(() => Promise.resolve(makeImageResponse()));
		vi.stubGlobal("fetch", fetchMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("hydrating the cache makes no requests", async () => {
		// Warming is the application's decision about WHAT to warm. A package
		// warming something by itself would spend the first screen's bandwidth on a
		// guess about someone else's data.
		const { policy } = makeBlobCachePolicy();

		await policy.hydrate();
		await flushBlobCache();

		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("does not refuse to cache a domain nobody told it about", async () => {
		// The CORS-closed host list is empty: a consumer who never heard of a
		// hard-coded host would look for the cause in their own code.
		const { policy, adapter } = makeBlobCachePolicy();

		policy.warmCache(BLOB_CACHE_URLS.BLOCKED);
		await flushBlobCache();

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(adapter.records.has(BLOB_CACHE_URLS.BLOCKED)).toBe(true);
	});

	it("does not cache HTML that arrived with status 200", async () => {
		// A sign-in page or a captive-portal stub arrives as an ordinary successful
		// response. Without the type check it would sit as an "image" for thirty
		// days: an object URL is minted, the `<img>` shows a broken image, and the
		// cache looks guilty rather than whoever returned the page.
		const { policy, adapter } = makeBlobCachePolicy();
		fetchMock.mockResolvedValue(
			new Response("<html>login</html>", {
				status: 200,
				headers: { "content-type": "text/html; charset=utf-8" },
			}),
		);

		policy.warmCache(BLOB_CACHE_URLS.S3);
		await flushBlobCache();

		expect(adapter.records.size).toBe(0);
	});

	it("narrowing the content type is the application's job", async () => {
		// The package caches blobs; "images only" is about a specific application
		// and is therefore configured from outside.
		const { policy, adapter } = makeBlobCachePolicy({
			configOverrides: { acceptContentType: (type: string) => type.startsWith("image/") },
		});
		fetchMock.mockResolvedValue(
			new Response(new Blob(["%PDF-1.4"]), {
				status: 200,
				headers: { "content-type": "application/pdf" },
			}),
		);

		policy.warmCache(BLOB_CACHE_URLS.S3);
		await flushBlobCache();

		expect(adapter.records.size).toBe(0);
	});
});
