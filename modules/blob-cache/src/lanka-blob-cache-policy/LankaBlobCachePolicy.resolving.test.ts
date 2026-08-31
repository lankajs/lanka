import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	BLOB_CACHE_URLS,
	flushBlobCache,
	makeBlob,
	makeImageResponse,
} from "../_testing/blobCacheTestDoubles";
import { makeBlobCachePolicy } from "../_testing/blobCachePolicyHarness";

/**
 * Resolving a `src` — the anti-flicker contract.
 *
 * The old service returned the network URL and later swapped in a data URL;
 * swapping a mounted `<img>`'s `src` discards the decoded frame and forces a
 * re-decode, which is the avatar flicker users reported. So the answer for a given
 * URL must be decided ONCE, synchronously, and never revised mid-mount.
 */
describe("LankaBlobCachePolicy — resolving a src", () => {
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		fetchMock = vi.fn(() => Promise.resolve(makeImageResponse()));
		vi.stubGlobal("fetch", fetchMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("returns the network URL when nothing is cached", () => {
		const { policy } = makeBlobCachePolicy();

		expect(policy.getInitialSrc(BLOB_CACHE_URLS.S3)).toBe(BLOB_CACHE_URLS.S3);
	});

	it("returns a cached object URL once the bytes are in memory", async () => {
		const { policy } = makeBlobCachePolicy();

		policy.getInitialSrc(BLOB_CACHE_URLS.S3);
		await flushBlobCache();

		expect(policy.getInitialSrc(BLOB_CACHE_URLS.S3)).toMatch(/^blob:fake\//);
	});

	it("reuses the SAME object URL for repeat resolutions", async () => {
		const { policy, env } = makeBlobCachePolicy();
		policy.getInitialSrc(BLOB_CACHE_URLS.S3);
		await flushBlobCache();

		const first = policy.getInitialSrc(BLOB_CACHE_URLS.S3);
		const second = policy.getInitialSrc(BLOB_CACHE_URLS.S3);

		expect(first).toBe(second);
		// One blob URL, not one per render — each live URL pins its blob in memory.
		expect(env.urls.created).toHaveLength(1);
	});

	it("never changes its answer for a URL while a fetch is in flight", async () => {
		let resolveFetch: (value: Response) => void = () => undefined;
		fetchMock.mockImplementation(
			() =>
				new Promise<Response>((resolve) => {
					resolveFetch = resolve;
				}),
		);
		const { policy } = makeBlobCachePolicy();

		const first = policy.getInitialSrc(BLOB_CACHE_URLS.S3);
		const duringFetch = policy.getInitialSrc(BLOB_CACHE_URLS.S3);
		resolveFetch(makeImageResponse());
		await flushBlobCache();

		expect(first).toBe(BLOB_CACHE_URLS.S3);
		expect(duringFetch).toBe(BLOB_CACHE_URLS.S3);
	});

	it("starts a background warm on the first resolve, so the next mount is instant", async () => {
		const { policy } = makeBlobCachePolicy();

		policy.getInitialSrc(BLOB_CACHE_URLS.S3);
		await flushBlobCache();

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("hydrated entries resolve synchronously on the very first call", async () => {
		const { policy, adapter, store } = makeBlobCachePolicy();
		await store.init();
		adapter.records.set(BLOB_CACHE_URLS.S3, {
			key: BLOB_CACHE_URLS.S3,
			blob: makeBlob(),
			lastUsedAt: 10,
			size: 8,
		});

		await policy.hydrate();

		// This is what makes a restart flicker-free: no await, no network, no swap.
		expect(policy.getInitialSrc(BLOB_CACHE_URLS.S3)).toMatch(/^blob:fake\//);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("resolves different URLs to different object URLs", async () => {
		const { policy } = makeBlobCachePolicy();

		policy.getInitialSrc(BLOB_CACHE_URLS.S3);
		policy.getInitialSrc(BLOB_CACHE_URLS.OTHER_S3);
		await flushBlobCache();

		expect(policy.getInitialSrc(BLOB_CACHE_URLS.S3)).not.toBe(
			policy.getInitialSrc(BLOB_CACHE_URLS.OTHER_S3),
		);
	});
});
