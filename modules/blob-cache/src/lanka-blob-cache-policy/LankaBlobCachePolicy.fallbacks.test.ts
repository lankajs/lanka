import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LankaBlobCachePolicy } from "./LankaBlobCachePolicy";
import {
	LankaBlobCacheStore,
	type IBlobCacheBackendCandidate,
} from "../store/lanka-blob-cache-store/LankaBlobCacheStore";
import { BLOB_CACHE_BACKEND } from "../store/blobCacheBackend";
import { LANKA_BLOB_CACHE_CONFIG } from "../lanka-blob-cache-config/lankaBlobCacheConfig";
import { FakeBlobStoreAdapter, makeBlob, makeEnvironment } from "../_testing/blobCacheTestDoubles";

/**
 * The degradation matrix.
 *
 * The application runs in whatever WebView it gets: any version of Android
 * System WebView, any Safari generation, private mode, and hardened builds where
 * storage APIs exist but refuse to work. So every capability the cache uses has
 * a rung below it, and the bottom rung is always the same — render the network
 * URL — which needs nothing but
 * `<img>`.
 *
 * Split into its own file rather than added to the main one: a suite past three
 * hundred lines is divided by subject.
 */

const S3_URL = "https://bucket.s3.ap-southeast-1.amazonaws.com/public/a.webp";

const imageResponse = () =>
	({
		ok: true,
		headers: {
			get: (name: string) => (name.toLowerCase() === "content-type" ? "image/webp" : null),
		},
		blob: () => Promise.resolve(makeBlob()),
	}) as unknown as Response;

const flush = async (): Promise<void> => {
	for (let tick = 0; tick < 6; tick += 1) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
};

const workingBackend = (adapter: FakeBlobStoreAdapter): readonly IBlobCacheBackendCandidate[] => [
	{
		backend: BLOB_CACHE_BACKEND.INDEXED_DB,
		build: () => adapter,
	},
];

describe("LankaBlobCachePolicy — object URL degradation", () => {
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		fetchMock = vi.fn(() => Promise.resolve(imageResponse()));
		vi.stubGlobal("fetch", fetchMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	/**
	 * The bytes are cached but this platform cannot mint a URL for them. The right
	 * answer is the network URL: the image still appears, we simply gained nothing
	 * from the cache. And crucially it must NOT throw — resolution happens during
	 * render, and an exception there is a white screen.
	 */
	it("serves the network URL when createObjectUrl is unavailable", async () => {
		const adapter = new FakeBlobStoreAdapter();
		const env = makeEnvironment({ createObjectUrl: () => null });
		const store = new LankaBlobCacheStore(
			env,
			LANKA_BLOB_CACHE_CONFIG,
			workingBackend(adapter),
		);
		const policy = new LankaBlobCachePolicy(env, LANKA_BLOB_CACHE_CONFIG, store);

		policy.getInitialSrc(S3_URL);
		await flush();

		expect(adapter.records.has(S3_URL)).toBe(true);
		expect(policy.getInitialSrc(S3_URL)).toBe(S3_URL);
	});

	it("does not throw during render when object URLs are unavailable", async () => {
		const env = makeEnvironment({ createObjectUrl: () => null });
		const store = new LankaBlobCacheStore(
			env,
			LANKA_BLOB_CACHE_CONFIG,
			workingBackend(new FakeBlobStoreAdapter()),
		);
		const policy = new LankaBlobCachePolicy(env, LANKA_BLOB_CACHE_CONFIG, store);
		policy.getInitialSrc(S3_URL);
		await flush();

		expect(() => policy.getInitialSrc(S3_URL)).not.toThrow();
	});

	it("tolerates a revoke that throws, and still clears its map", async () => {
		const env = makeEnvironment({
			revokeObjectUrl: () => {
				throw new Error("revoke denied");
			},
		});
		const store = new LankaBlobCacheStore(
			env,
			LANKA_BLOB_CACHE_CONFIG,
			workingBackend(new FakeBlobStoreAdapter()),
		);
		const policy = new LankaBlobCachePolicy(env, LANKA_BLOB_CACHE_CONFIG, store);
		policy.getInitialSrc(S3_URL);
		await flush();
		policy.getInitialSrc(S3_URL);

		// Cleanup must never be the thing that breaks sign-out or page hide.
		expect(() => policy.releaseObjectUrls()).not.toThrow();
		await expect(policy.clear()).resolves.toBeUndefined();
	});

	it("keeps revoking the rest when one revoke throws", async () => {
		let calls = 0;
		const env = makeEnvironment({
			revokeObjectUrl: () => {
				calls += 1;
				if (calls === 1) throw new Error("first one refused");
			},
		});
		const store = new LankaBlobCacheStore(
			env,
			LANKA_BLOB_CACHE_CONFIG,
			workingBackend(new FakeBlobStoreAdapter()),
		);
		const policy = new LankaBlobCachePolicy(env, LANKA_BLOB_CACHE_CONFIG, store);
		policy.getInitialSrc(S3_URL);
		policy.getInitialSrc(`${S3_URL}?v=2`);
		await flush();
		policy.getInitialSrc(S3_URL);
		policy.getInitialSrc(`${S3_URL}?v=2`);

		policy.releaseObjectUrls();

		// A guard around the whole loop would leak every URL after the first
		// failure; that is why it sits inside the iteration.
		expect(calls).toBe(2);
	});
});

describe("LankaBlobCachePolicy — no fetch at all", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("keeps rendering images when fetch is missing", async () => {
		vi.stubGlobal("fetch", undefined);
		const adapter = new FakeBlobStoreAdapter();
		const env = makeEnvironment();
		const store = new LankaBlobCacheStore(
			env,
			LANKA_BLOB_CACHE_CONFIG,
			workingBackend(adapter),
		);
		const policy = new LankaBlobCachePolicy(env, LANKA_BLOB_CACHE_CONFIG, store);

		expect(policy.getInitialSrc(S3_URL)).toBe(S3_URL);
		await flush();

		// Nothing to store, nothing thrown — the `<img>` loads from the network.
		expect(adapter.records.size).toBe(0);
	});

	it("marks the URL failed instead of retrying forever", async () => {
		vi.stubGlobal("fetch", undefined);
		const env = makeEnvironment();
		const store = new LankaBlobCacheStore(
			env,
			LANKA_BLOB_CACHE_CONFIG,
			workingBackend(new FakeBlobStoreAdapter()),
		);
		const policy = new LankaBlobCachePolicy(env, LANKA_BLOB_CACHE_CONFIG, store);

		policy.warmCache(S3_URL);
		await flush();
		policy.warmCache(S3_URL);
		await flush();

		expect(() => policy.warmCache(S3_URL)).not.toThrow();
	});
});

describe("LankaBlobCachePolicy — full platform matrix", () => {
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		fetchMock = vi.fn(() => Promise.resolve(imageResponse()));
		vi.stubGlobal("fetch", fetchMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	const scenarios: ReadonlyArray<{
		name: string;
		candidates: readonly IBlobCacheBackendCandidate[];
		createObjectUrl?: () => string | null;
	}> = [
		{
			name: "modern: IndexedDB + object URLs",
			candidates: workingBackend(new FakeBlobStoreAdapter()),
		},
		{
			name: "IDB blocked, Cache Storage available",
			candidates: [
				{
					backend: BLOB_CACHE_BACKEND.INDEXED_DB,
					build: () => null,
				},
				{
					backend: BLOB_CACHE_BACKEND.CACHE_STORAGE,
					build: () => new FakeBlobStoreAdapter(),
				},
			],
		},
		{
			name: "no persistent storage at all",
			candidates: [],
		},
		{
			name: "storage present but object URLs unavailable",
			candidates: workingBackend(new FakeBlobStoreAdapter()),
			createObjectUrl: () => null,
		},
		{
			name: "every builder throws",
			candidates: [
				{
					backend: BLOB_CACHE_BACKEND.INDEXED_DB,
					build: () => {
						throw new Error("nope");
					},
				},
				{
					backend: BLOB_CACHE_BACKEND.CACHE_STORAGE,
					build: () => {
						throw new Error("nope");
					},
				},
			],
		},
	];

	it.each(scenarios)(
		"$name — always resolves to something renderable",
		async ({ candidates, createObjectUrl }) => {
			const env = makeEnvironment(createObjectUrl ? { createObjectUrl } : {});
			const store = new LankaBlobCacheStore(env, LANKA_BLOB_CACHE_CONFIG, candidates);
			const policy = new LankaBlobCachePolicy(env, LANKA_BLOB_CACHE_CONFIG, store);

			await policy.hydrate();
			const first = policy.getInitialSrc(S3_URL);
			await flush();
			const second = policy.getInitialSrc(S3_URL);

			// True on EVERY rung: both answers are usable by an `<img>`, and neither
			// is empty.
			expect(first).toBe(S3_URL);
			expect(second === S3_URL || second?.startsWith("blob:")).toBe(true);
		},
	);

	it.each(scenarios)(
		"$name — hydrate and clear never throw",
		async ({ candidates, createObjectUrl }) => {
			const env = makeEnvironment(createObjectUrl ? { createObjectUrl } : {});
			const store = new LankaBlobCacheStore(env, LANKA_BLOB_CACHE_CONFIG, candidates);
			const policy = new LankaBlobCachePolicy(env, LANKA_BLOB_CACHE_CONFIG, store);

			await expect(policy.hydrate()).resolves.toBeUndefined();
			await expect(policy.clear()).resolves.toBeUndefined();
		},
	);
});
