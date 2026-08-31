/**
 * @lankajs/blob-cache — a persistent blob cache over `@lankajs/storage` adapters.
 *
 * A module, not a plugin: core calls nothing here.
 *
 * Applies to content-addressed content only — the key carries a uuid and the
 * response is immutable, so a stale entry cannot exist. MUST NOT be used on a
 * mutable URL: freshness is never revalidated.
 *
 * Everything the application decides — store names, CORS-blocked hosts, allowed
 * content types, what counts as the end of a session — is configured from
 * outside.
 */

export { LankaBlobCachePolicy } from "./lanka-blob-cache-policy/LankaBlobCachePolicy";
export { LankaBlobCacheStore } from "./store/lanka-blob-cache-store/LankaBlobCacheStore";
export { LankaCacheStorageBlobAdapter } from "./lanka-cache-storage-blob-adapter/LankaCacheStorageBlobAdapter";
export { setupLankaBlobCacheLifecycle } from "./setup-lanka-blob-cache-lifecycle/setupLankaBlobCacheLifecycle";
export { LANKA_BLOB_CACHE_CONFIG } from "./lanka-blob-cache-config/lankaBlobCacheConfig";
export { createObjectUrlSafely, revokeObjectUrlSafely } from "./_utils/object-url/objectUrl";

export type { TLankaBlobCacheConfig } from "./lanka-blob-cache-config/lankaBlobCacheConfig";
export type { ILankaBlobCacheEnvironment } from "./store/lanka-blob-cache-store/LankaBlobCacheStore";
export type { TLankaBlobCacheBackend } from "./store/blobCacheBackend";
export type { ILankaBlobCacheLifecycleOptions } from "./setup-lanka-blob-cache-lifecycle/setupLankaBlobCacheLifecycle";
