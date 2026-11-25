import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LankaBlobCacheStore, type IBlobCacheBackendCandidate } from "./LankaBlobCacheStore";
import type { ILankaBlobRecord } from "@lankajs/storage";
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

	/**
	 * An IndexedDB frozen mid-probe: the first write never lands, because the page
	 * stopped; after resume the same connection works.
	 */
	class StallsOnceAdapter extends FakeBlobStoreAdapter {
		private stalled = false;
		public override put(record: ILankaBlobRecord): Promise<void> {
			if (this.stalled) return super.put(record);
			this.stalled = true;
			return new Promise<void>(() => undefined);
		}
	}

	/** Both rungs present, as on most WebViews: IndexedDB first, Cache Storage below. */
	const twoRungs = (indexedDb: FakeBlobStoreAdapter | HangingBlobStoreAdapter) =>
		makeStore(
			[
				candidate(BLOB_CACHE_BACKEND.INDEXED_DB, () => indexedDb),
				candidate(BLOB_CACHE_BACKEND.CACHE_STORAGE, () => new FakeBlobStoreAdapter()),
			],
			{ probeTimeoutMs: 50 },
		);

	it("keeps IndexedDB when its probe was frozen, instead of stepping down to Cache Storage", async () => {
		// The overdue deadline fired on resume, the chain stepped down, and Cache
		// Storage — probed on a page visible again — was kept for the session: the
		// cache earlier sessions filled was never read, and every image refetched.
		const { store } = twoRungs(new StallsOnceAdapter());

		const chosen = store.init();
		setVisibility("hidden");
		setVisibility("visible");
		await vi.advanceTimersByTimeAsync(50);

		expect(await chosen).toBe(BLOB_CACHE_BACKEND.INDEXED_DB);
	});

	it("a page already hidden when the probe starts counts too", async () => {
		// A WebView started in the background, or a tab probed while hidden,
		// never sends the event the probe would otherwise wait for.
		visibility = "hidden";
		const { store } = twoRungs(new StallsOnceAdapter());

		const chosen = store.init();
		await vi.advanceTimersByTimeAsync(50);

		expect(await chosen).toBe(BLOB_CACHE_BACKEND.INDEXED_DB);
	});

	it("an unload seen during the probe counts as the background too", async () => {
		const { store } = twoRungs(new StallsOnceAdapter());

		const chosen = store.init();
		window.dispatchEvent(new Event("pagehide"));
		await vi.advanceTimersByTimeAsync(50);

		expect(await chosen).toBe(BLOB_CACHE_BACKEND.INDEXED_DB);
	});

	it("retries a rung once, not forever: one that really does not work still steps down", async () => {
		const { store } = twoRungs(new HangingBlobStoreAdapter());

		const chosen = store.init();
		setVisibility("hidden");
		setVisibility("visible");
		await vi.advanceTimersByTimeAsync(100);

		expect(await chosen).toBe(BLOB_CACHE_BACKEND.CACHE_STORAGE);
	});

	it("a probe that fails on a page that stayed visible steps down at once, as before", async () => {
		const { store } = twoRungs(new StallsOnceAdapter());

		const chosen = store.init();
		await vi.advanceTimersByTimeAsync(50);

		expect(await chosen).toBe(BLOB_CACHE_BACKEND.CACHE_STORAGE);
	});

	it("without a `document`, a failed probe steps down as before", async () => {
		vi.stubGlobal("document", undefined);
		try {
			const { store } = twoRungs(new StallsOnceAdapter());

			const chosen = store.init();
			await vi.advanceTimersByTimeAsync(50);

			expect(await chosen).toBe(BLOB_CACHE_BACKEND.CACHE_STORAGE);
		} finally {
			vi.unstubAllGlobals();
		}
	});
});
