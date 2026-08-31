/**
 * Defaults for the persistent blob cache.
 *
 * The cache pays off on content-addressed content: when the key carries a uuid
 * and the response is `Cache-Control: immutable`, a stale entry is impossible.
 * This cache must NOT be used on a mutable URL: it never checks freshness and
 * never asks the server.
 *
 * Everything application-specific — store names, blocked hosts, accepted content
 * types — is overridden when the policy is created.
 */
export const LANKA_BLOB_CACHE_CONFIG = {
	/** IndexedDB database name; bump `dbVersion` when the schema changes. */
	dbName: "lanka-blob-cache",
	dbVersion: 1,

	/** Cache Storage bucket used when IndexedDB is unavailable. */
	cacheStorageName: "lanka-blob-cache-v1",

	/**
	 * Availability probe deadline.
	 *
	 * iOS private mode and some Android WebViews leave `indexedDB.open()` pending
	 * forever instead of rejecting; without a deadline the whole cache would hang
	 * behind an unresolved promise.
	 */
	probeTimeoutMs: 1500,

	/**
	 * Total byte budget.
	 *
	 * iOS WebKit grants about fifty megabytes per origin and can revoke it without
	 * warning, so we stay well under and evict ourselves rather than wait for the
	 * platform to do it destructively.
	 */
	maxTotalBytes: 16 * 1024 * 1024,

	/** An entry larger than this is served from the network and never stored. */
	maxEntryBytes: 2 * 1024 * 1024,

	/**
	 * Byte budget for the MEMORY tier, enforced independently of
	 * {@link maxTotalBytes}.
	 *
	 * The tiers diverge: `enforceBudget` returns immediately when there is no
	 * persistent backend, so on a platform with neither IndexedDB nor Cache Storage
	 * NOTHING would bound the memory map and a long session would accumulate every
	 * image it touched, at up to {@link maxEntryBytes} each. The same gap opens
	 * whenever a persistent write fails twice and the record stays resident.
	 *
	 * Half the disk budget: memory is the scarcer resource, and this still holds
	 * several full {@link hydrateLimit} rounds.
	 */
	maxMemoryBytes: 8 * 1024 * 1024,

	/** What fraction of the store is dropped on overflow, oldest first. */
	evictionRatio: 0.25,

	/**
	 * Entry lifetime.
	 *
	 * Not a correctness mechanism: URLs are content-addressed, so a stale entry is
	 * impossible. The TTL exists only to stop the store hoarding images the user
	 * has not seen for months.
	 */
	ttlMs: 30 * 24 * 60 * 60 * 1000,

	/**
	 * How many entries are materialised into object URLs at startup.
	 *
	 * This is what makes the cache flicker-free: an image whose object URL is
	 * already in memory is returned SYNCHRONOUSLY on first render, so the `<img>`
	 * never swaps its `src`. Bounded because each live object URL pins its blob
	 * until revoked.
	 */
	hydrateLimit: 80,

	/** Parallel network fetches during a warm-up burst. */
	maxConcurrent: 3,

	/**
	 * Hosts whose bytes are unreachable cross-origin: `fetch` is rejected by CORS
	 * and `no-cors` yields an opaque response whose body cannot be read without
	 * Service Worker.
	 *
	 * EMPTY by default, and that matters: a package shipping one app's host list
	 * would silently refuse to cache a domain for a consumer who never heard of
	 * that list.
	 *
	 * Such URLs go to `<img>` untouched — rendering needs no CORS — and rely on
	 * the engine's own HTTP cache.
	 */
	corsBlockedOrigins: [] as ReadonlyArray<string>,

	/**
	 * Turns a CORS-blocked URL into a same-origin one, or `null` to leave the
	 * bypass in place. The single switch that enables caching for such images once
	 * the app has a proxying endpoint.
	 */
	sameOriginProxy: null as ((src: string) => string | null) | null,

	/**
	 * What counts as storable, by the `content-type` header.
	 *
	 * HTML and an empty type are rejected by default. Not tidiness: a sign-in page
	 * or a captive-portal stub arrives with status 200, and without this check it
	 * would land in the cache as an "image" — an object URL, a broken render and a
	 * thirty-day TTL. The app narrows further:
	 * `(type) => type.startsWith("image/")`.
	 */
	acceptContentType: ((contentType: string): boolean => {
		const type = contentType.toLowerCase();
		return type.length > 0 && !type.startsWith("text/html");
	}) as (contentType: string) => boolean,
} as const;

export type TLankaBlobCacheConfig = typeof LANKA_BLOB_CACHE_CONFIG;
