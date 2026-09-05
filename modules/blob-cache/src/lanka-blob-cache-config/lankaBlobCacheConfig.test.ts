import { describe, expect, it } from "vitest";
import { LANKA_BLOB_CACHE_CONFIG, type TLankaBlobCacheConfig } from "./lankaBlobCacheConfig";
import { LankaBlobCachePolicy } from "../lanka-blob-cache-policy/LankaBlobCachePolicy";

/**
 * What must hold for the configuration.
 *
 * These numbers are tuning, but some COMBINATIONS are silently broken rather than
 * merely worse: an entry cap above the total budget makes every large image
 * unstorable, and an eviction ratio of zero loops forever on a full store. A
 * misconfiguration produces no error anywhere, so it is pinned here.
 */
describe("LANKA_BLOB_CACHE_CONFIG", () => {
	it("keeps a single entry well below the total budget", () => {
		// Otherwise one image would fill the store and evict everything else on
		// every write.
		expect(LANKA_BLOB_CACHE_CONFIG.maxEntryBytes).toBeLessThan(
			LANKA_BLOB_CACHE_CONFIG.maxTotalBytes / 4,
		);
	});

	it("stays well under the ~50MB iOS WebKit origin allowance", () => {
		expect(LANKA_BLOB_CACHE_CONFIG.maxTotalBytes).toBeLessThan(30 * 1024 * 1024);
	});

	it("evicts a real fraction on overflow", () => {
		// Zero frees nothing; one empties the cache on the first overflow.
		expect(LANKA_BLOB_CACHE_CONFIG.evictionRatio).toBeGreaterThan(0);
		expect(LANKA_BLOB_CACHE_CONFIG.evictionRatio).toBeLessThan(1);
	});

	it("bounds memory more tightly than disk, and roomily enough to hydrate", () => {
		// Memory is the scarcer resource, so its budget must not exceed the disk
		// one: otherwise the tighter-looking limit would bind nothing.
		expect(LANKA_BLOB_CACHE_CONFIG.maxMemoryBytes).toBeLessThanOrEqual(
			LANKA_BLOB_CACHE_CONFIG.maxTotalBytes,
		);
		// …but must fit a full hydration of entry-sized blobs, or startup would
		// evict exactly what it just lifted for a flicker-free first paint.
		expect(LANKA_BLOB_CACHE_CONFIG.maxMemoryBytes).toBeGreaterThan(
			LANKA_BLOB_CACHE_CONFIG.hydrateLimit * 64 * 1024,
		);
	});

	it("hydrates a bounded number of entries", () => {
		// Every hydrated entry pins its bytes in memory until its URL is revoked.
		expect(LANKA_BLOB_CACHE_CONFIG.hydrateLimit).toBeGreaterThan(0);
		expect(LANKA_BLOB_CACHE_CONFIG.hydrateLimit).toBeLessThanOrEqual(200);
	});

	it("keeps warm-up maxConcurrent small enough not to starve the screen", () => {
		expect(LANKA_BLOB_CACHE_CONFIG.maxConcurrent).toBeGreaterThan(0);
		expect(LANKA_BLOB_CACHE_CONFIG.maxConcurrent).toBeLessThanOrEqual(4);
	});

	it("times the availability probe out fast enough not to stall first paint", () => {
		// In iOS private mode `indexedDB.open()` never settles, and the whole cache
		// waits behind this deadline.
		expect(LANKA_BLOB_CACHE_CONFIG.probeTimeoutMs).toBeGreaterThan(0);
		expect(LANKA_BLOB_CACHE_CONFIG.probeTimeoutMs).toBeLessThanOrEqual(3000);
	});

	it("uses a TTL measured in days, not minutes", () => {
		// URLs are content-addressed, so the TTL is only about hoarding: too short a
		// one would re-download images the user sees every day.
		expect(LANKA_BLOB_CACHE_CONFIG.ttlMs).toBeGreaterThan(24 * 60 * 60 * 1000);
	});

	it("declares a database version, so a schema change can migrate", () => {
		expect(LANKA_BLOB_CACHE_CONFIG.dbVersion).toBeGreaterThanOrEqual(1);
		expect(LANKA_BLOB_CACHE_CONFIG.dbName.length).toBeGreaterThan(0);
	});

	it("versions the Cache Storage bucket name", () => {
		// A rename is the only way to invalidate a Cache Storage bucket wholesale.
		expect(LANKA_BLOB_CACHE_CONFIG.cacheStorageName).toMatch(/v\d+$/);
	});
});

describe("the application's decisions, not the package's", () => {
	it("blocks no host by default", () => {
		// A package shipping one application's host list would silently refuse to
		// cache a domain for a consumer who never heard of that list, and they
		// would look for the cause in their own code.
		expect(LANKA_BLOB_CACHE_CONFIG.corsBlockedOrigins).toEqual([]);
	});

	it("proxies nothing by default", () => {
		// Proxying enabled without an endpoint would send every image to a 404 —
		// losing them entirely.
		expect(LANKA_BLOB_CACHE_CONFIG.sameOriginProxy).toBeNull();
	});

	it("rejects HTML and an empty type without narrowing to images", () => {
		// A sign-in page or a captive-portal stub arrives with status 200; without
		// this check it would sit in the cache as an "image" for thirty days.
		// Narrowing to `image/` is the application's job: the package caches blobs,
		// not images.
		expect(LANKA_BLOB_CACHE_CONFIG.acceptContentType("text/html; charset=utf-8")).toBe(false);
		expect(LANKA_BLOB_CACHE_CONFIG.acceptContentType("")).toBe(false);
		expect(LANKA_BLOB_CACHE_CONFIG.acceptContentType("image/webp")).toBe(true);
		expect(LANKA_BLOB_CACHE_CONFIG.acceptContentType("application/pdf")).toBe(true);
	});

	// A store name is visible in a consumer's devtools and collides with whatever
	// else is in their origin. It carries the framework's name and nobody else's —
	// least of all an application this package once lived inside.
	it("store names are the framework's own", () => {
		expect(LANKA_BLOB_CACHE_CONFIG.dbName).toContain("lanka");
		expect(LANKA_BLOB_CACHE_CONFIG.cacheStorageName).toContain("lanka");
	});
});

describe("the type admits a consumer's own names", () => {
	it("accepts a config whose store names and budgets are not the defaults", () => {
		// This used to be a TYPE error, not a runtime one: the type was `typeof` an
		// `as const` object, so `dbName` could only ever be the literal
		// "lanka-blob-cache". The guide promised the opposite in its first paragraph,
		// and the first application with an IndexedDB under its own name — and every
		// returning user's avatars in it — had no typed way to keep it.
		const consumer: TLankaBlobCacheConfig = {
			...LANKA_BLOB_CACHE_CONFIG,
			dbName: "my-app-image-cache",
			dbVersion: 2,
			cacheStorageName: "my-app-image-cache-v2",
			hydrateLimit: 40,
			corsBlockedOrigins: ["t.me"],
		};

		expect(consumer.dbName).toBe("my-app-image-cache");
		// And the policy takes it: the parameter is typed with the same name.
		expect(() => new LankaBlobCachePolicy(undefined, consumer)).not.toThrow();
	});
});
