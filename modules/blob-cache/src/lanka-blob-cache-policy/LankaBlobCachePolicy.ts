import {
	LANKA_BLOB_CACHE_CONFIG,
	type TLankaBlobCacheConfig,
} from "../lanka-blob-cache-config/lankaBlobCacheConfig";
import {
	LankaBlobCacheStore,
	type ILankaBlobCacheEnvironment,
} from "../store/lanka-blob-cache-store/LankaBlobCacheStore";
import { type TLankaBlobCacheBackend } from "../store/blobCacheBackend";
import { createObjectUrlSafely, revokeObjectUrlSafely } from "../_utils/object-url/objectUrl";

/**
 * Reads a global without being able to throw.
 *
 * `typeof` rather than `"x" in window`: some private modes throw on the property
 * ACCESS to `indexedDB`/`caches`, and `typeof` is the only form that cannot.
 * Unavailable becomes `undefined`, which the store reads as "that rung is
 * missing" and moves to the next.
 */
const safeGlobal = <T>(read: () => T): T | undefined => {
	try {
		return read();
	} catch {
		return undefined;
	}
};

const browserEnvironment: ILankaBlobCacheEnvironment = {
	indexedDb: safeGlobal(() => (typeof indexedDB === "undefined" ? undefined : indexedDB)),
	caches: safeGlobal(() => (typeof caches === "undefined" ? undefined : caches)),
	now: () => Date.now(),
	createObjectUrl: createObjectUrlSafely,
	revokeObjectUrl: revokeObjectUrlSafely,
};

/**
 * Serves images from a persistent cache without ever making an `<img>` swap its
 * `src`.
 *
 * ## The no-swap rule is the whole point
 *
 * Swapping `src` on a mounted `<img>` makes the browser discard the decoded
 * frame and decode again — visible flicker. Therefore:
 *
 * - `getInitialSrc` is SYNCHRONOUS and final for a given URL. Blob in memory →
 *   an object URL created on the spot (`createObjectURL` needs no await);
 *   otherwise the network URL;
 * - nothing ever "upgrades" an image that is already rendered. A fetched blob is
 *   stored for the NEXT mount and the next session;
 * - `hydrate()` lifts recent entries into memory at startup, so after a restart
 *   the first render already takes the synchronous path.
 *
 * ## Fallback chain
 *
 * The rung is chosen in {@link LankaBlobCacheStore}: IndexedDB → Cache Storage →
 * memory, by a real write-and-read probe. On the memory rung behaviour is
 * exactly what it was without a cache, so the degradation is invisible.
 *
 * A fourth level is no cache at all: CORS-closed hosts whose bytes are
 * unreachable (`fetch` rejects, `no-cors` yields an opaque response). Those URLs
 * go to `<img>` untouched — rendering needs no CORS — and rely on the browser's
 * own HTTP cache. Caching them requires a same-origin proxy; `sameOriginProxy`
 * is that switch.
 */
export class LankaBlobCachePolicy {
	private readonly config: TLankaBlobCacheConfig;
	private readonly env: ILankaBlobCacheEnvironment;
	private readonly store: LankaBlobCacheStore;
	/** Cache key → live object URL. Must be revoked to release the blob. */
	private readonly objectUrlByKey = new Map<string, string>();
	/** In-flight requests: N components asking for one image make one request. */
	private readonly pendingByKey = new Map<string, Promise<void>>();
	/** Keys queued for a free slot, oldest first. */
	private readonly queue: { key: string; fetchUrl: string }[] = [];
	/** How many requests are in flight; the ceiling is `maxConcurrent`. */
	private activeFetches = 0;
	/** Keys that failed; retried only in the next session. */
	private readonly failedKeys = new Set<string>();
	private hydration: Promise<void> | null = null;

	constructor(
		env: ILankaBlobCacheEnvironment = browserEnvironment,
		config: TLankaBlobCacheConfig = LANKA_BLOB_CACHE_CONFIG,
		store?: LankaBlobCacheStore,
	) {
		this.env = env;
		this.config = config;
		this.store = store ?? new LankaBlobCacheStore(env, config);
	}

	/**
	 * Resolves the backend and lifts recent entries into memory.
	 *
	 * Called once at startup, BEFORE the first screen renders, so cached images
	 * take the synchronous path from the very first render.
	 */
	public hydrate(): Promise<void> {
		if (!this.hydration) {
			this.hydration = this.runHydration();
		}
		return this.hydration;
	}

	public getBackend(): TLankaBlobCacheBackend {
		return this.store.getBackend();
	}

	/**
	 * The single source of truth for what an `<img>` should load.
	 *
	 * Synchronous and stable for a given URL within a session: the caller must NOT
	 * re-resolve and swap it later.
	 */
	public getInitialSrc(src: string): string | undefined {
		const key = this.toCacheKey(src);
		if (key === null) return src;

		const existingUrl = this.objectUrlByKey.get(key);
		if (existingUrl) return existingUrl;

		const record = this.store.peek(key);
		if (record) {
			const objectUrl = this.env.createObjectUrl(record.blob);
			if (objectUrl !== null) {
				this.objectUrlByKey.set(key, objectUrl);
				return objectUrl;
			}
			// The platform cannot mint object URLs: the bytes are cached but unusable,
			// so the network URL is served. Still no swap and no flicker — simply no
			// gain either.
			return src;
		}

		// Not cached yet: render straight from the network and store the bytes in
		// the background for next time. No swap, no flicker.
		this.warmCache(src);
		return src;
	}

	/**
	 * Queues an image for fetching, blocking nothing.
	 *
	 * Safe to call for every visible image: already cached, in flight, failed and
	 * CORS-closed URLs are all no-ops.
	 *
	 * QUEUED rather than sent immediately: a list renders fifty images in one
	 * pass and each one calls this. Sending them together would put fifty requests
	 * on the wire ahead of the screen's own data. At most `maxConcurrent` run at
	 * once; the rest wait.
	 */
	public warmCache(src: string | null | undefined): void {
		const normalizedSrc = src ?? undefined;
		if (!normalizedSrc) return;

		const key = this.toCacheKey(normalizedSrc);
		if (key === null) return;
		if (this.objectUrlByKey.has(key)) return;
		if (this.failedKeys.has(key)) return;
		if (this.pendingByKey.has(key)) return;
		if (this.queue.some((queued) => queued.key === key)) return;
		if (this.store.peek(key)) return;

		this.queue.push({
			key,
			fetchUrl: this.toFetchUrl(normalizedSrc),
		});
		this.pumpQueue();
	}

	/** Starts as many queued requests as the ceiling allows. */
	private pumpQueue(): void {
		while (this.activeFetches < this.config.maxConcurrent && this.queue.length > 0) {
			const next = this.queue.shift();
			if (!next) return;
			this.startFetch(next.key, next.fetchUrl);
		}
	}

	private startFetch(key: string, fetchUrl: string): void {
		this.activeFetches += 1;
		const pending = this.fetchAndStore(key, fetchUrl)
			.catch(() => {
				this.failedKeys.add(key);
			})
			.finally(() => {
				this.pendingByKey.delete(key);
				this.activeFetches -= 1;
				// A freed slot must admit the next image immediately, or a long list
				// stalls after the first batch.
				this.pumpQueue();
			});

		this.pendingByKey.set(key, pending);
	}

	/**
	 * Drops everything, live object URLs included.
	 *
	 * MUST run on sign-out: these blobs are other people's faces, and the next
	 * user of the device must not see them.
	 */
	public async clear(): Promise<void> {
		this.releaseObjectUrls();
		// The queue is cleared too: its URLs belong to the session being closed,
		// and letting them land would refill the store right after clearing it.
		this.queue.length = 0;
		this.pendingByKey.clear();
		this.failedKeys.clear();
		await this.store.clear();
	}

	/**
	 * Revokes object URLs without touching stored blobs.
	 *
	 * Each revoke is guarded separately: one engine refusing to revoke must
	 * neither break the loop (leaking the rest) nor surface out of sign-out or
	 * page hide.
	 */
	public releaseObjectUrls(): void {
		for (const objectUrl of this.objectUrlByKey.values()) {
			try {
				this.env.revokeObjectUrl(objectUrl);
			} catch {
				// A URL we fail to revoke is a leak we cannot prevent; carry on.
			}
		}
		this.objectUrlByKey.clear();
	}

	// ────────────────────────────────────────────────────
	// Private
	// ────────────────────────────────────────────────────

	private async runHydration(): Promise<void> {
		await this.store.init();
		await this.store.hydrateRecent(this.config.hydrateLimit);
	}

	private async fetchAndStore(key: string, fetchUrl: string): Promise<void> {
		// No `fetch` at all (a very old WebView): nothing can fetch the bytes, so
		// the cache stays empty and `<img>` keeps loading from the network.
		// Checked explicitly rather than left to an exception, so it reads as a
		// supported state.
		if (typeof fetch !== "function") {
			throw new Error("fetch is unavailable");
		}

		// `force-cache` lets the browser's own HTTP cache answer when it still has
		// the bytes: on a warm cache the warm-up costs nothing.
		const response = await fetch(fetchUrl, { cache: "force-cache" });
		if (!response.ok) {
			throw new Error(`failed to fetch image: ${String(response.status)}`);
		}
		const contentType = response.headers.get("content-type") ?? "";
		if (!this.config.acceptContentType(contentType)) {
			throw new Error(`unsupported content type: ${contentType}`);
		}
		await this.store.put(key, await response.blob());
	}

	/**
	 * The cache key, or `null` when the image is not ours to cache.
	 *
	 * The key is the ORIGINAL URL even when fetching goes through a proxy, so
	 * enabling `sameOriginProxy` later does not orphan already-stored entries.
	 */
	private toCacheKey(src: string): string | null {
		if (!this.isCorsBlocked(src)) return src;
		return this.config.sameOriginProxy?.(src) ? src : null;
	}

	private toFetchUrl(src: string): string {
		if (!this.isCorsBlocked(src)) return src;
		return this.config.sameOriginProxy?.(src) ?? src;
	}

	private isCorsBlocked(src: string): boolean {
		try {
			const { hostname } = new URL(src, "https://localhost");
			return this.config.corsBlockedOrigins.some(
				(blocked) => hostname === blocked || hostname.endsWith(`.${blocked}`),
			);
		} catch {
			return false;
		}
	}
}
