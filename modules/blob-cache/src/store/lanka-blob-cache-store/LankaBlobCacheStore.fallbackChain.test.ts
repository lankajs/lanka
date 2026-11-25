import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

describe("LankaBlobCacheStore — a probe the app went to the background during", () => {
	let visibility: DocumentVisibilityState = "visible";
	const setVisibility = (state: DocumentVisibilityState): void => {
		visibility = state;
		document.dispatchEvent(new Event("visibilitychange"));
	};

	beforeEach(() => {
		visibility = "visible";
		Object.defineProperty(document, "visibilityState", {
			configurable: true,
			get: () => visibility,
		});
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		Reflect.deleteProperty(document, "visibilityState");
	});

	/** IndexedDB that hangs until `works` is set, as one frozen mid-probe does. */
	const chainWhere = (works: () => boolean) =>
		makeStore(
			[
				candidate(BLOB_CACHE_BACKEND.INDEXED_DB, () =>
					works() ? new FakeBlobStoreAdapter() : new HangingBlobStoreAdapter(),
				),
			],
			{ probeTimeoutMs: 50 },
		);

	it("decides nothing: the store waits in memory and probes again on the next call", async () => {
		// A WebView frozen mid-probe fired the probe's deadline on resume, and the
		// cache fell to memory for the whole session on a device whose IndexedDB
		// works.
		let works = false;
		const { store } = chainWhere(() => works);

		const first = store.init();
		setVisibility("hidden");
		setVisibility("visible");
		await vi.advanceTimersByTimeAsync(50);
		expect(await first).toBe(BLOB_CACHE_BACKEND.MEMORY);

		works = true;
		const second = store.init();
		await vi.advanceTimersByTimeAsync(0);
		expect(await second).toBe(BLOB_CACHE_BACKEND.INDEXED_DB);
	});

	it("an unload seen during the probe counts as the background too", async () => {
		let works = false;
		const { store } = chainWhere(() => works);

		const first = store.init();
		window.dispatchEvent(new Event("pagehide"));
		await vi.advanceTimersByTimeAsync(50);
		expect(await first).toBe(BLOB_CACHE_BACKEND.MEMORY);

		works = true;
		const second = store.init();
		await vi.advanceTimersByTimeAsync(0);
		expect(await second).toBe(BLOB_CACHE_BACKEND.INDEXED_DB);
	});

	it("without a `document`, a failed probe settles the session as before", async () => {
		vi.stubGlobal("document", undefined);
		try {
			let works = false;
			const { store } = chainWhere(() => works);

			const first = store.init();
			await vi.advanceTimersByTimeAsync(50);
			expect(await first).toBe(BLOB_CACHE_BACKEND.MEMORY);

			works = true;
			expect(await store.init()).toBe(BLOB_CACHE_BACKEND.MEMORY);
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it("a probe that fails on a page that stayed visible still settles the session", async () => {
		let works = false;
		const { store } = chainWhere(() => works);

		const first = store.init();
		await vi.advanceTimersByTimeAsync(50);
		expect(await first).toBe(BLOB_CACHE_BACKEND.MEMORY);

		works = true;
		expect(await store.init()).toBe(BLOB_CACHE_BACKEND.MEMORY);
	});
});
