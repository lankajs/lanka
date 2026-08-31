/** Which rung the store settled on. Visible to logs and tests. */
export const BLOB_CACHE_BACKEND = {
	INDEXED_DB: "indexeddb",
	CACHE_STORAGE: "cachestorage",
	MEMORY: "memory",
} as const;

export type TLankaBlobCacheBackend = (typeof BLOB_CACHE_BACKEND)[keyof typeof BLOB_CACHE_BACKEND];
