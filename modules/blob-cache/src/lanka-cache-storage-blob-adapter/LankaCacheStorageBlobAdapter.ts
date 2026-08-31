import type { ILankaBlobRecord, ILankaBlobStoreAdapter } from "@lankajs/storage";

/**
 * Blob → ArrayBuffer in three rungs, because this runs in whatever WebView the
 * client embeds.
 *
 *   1. `Blob.arrayBuffer()` — roughly Chrome 76 / Safari 14 and later.
 *   2. `FileReader` — available essentially everywhere, just clumsier.
 *   3. `new Response(blob).arrayBuffer()` — works in any engine that has Cache
 *      Storage, which by definition is any engine that reached this code.
 *
 * If none exist the promise rejects, the Cache Storage probe fails, and the
 * store steps down to memory. Nothing crashes.
 */
const blobToArrayBuffer = (blob: Blob): Promise<ArrayBuffer> => {
	if (typeof blob.arrayBuffer === "function") return blob.arrayBuffer();

	if (typeof FileReader === "function") {
		return new Promise<ArrayBuffer>((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => {
				if (reader.result instanceof ArrayBuffer) {
					resolve(reader.result);
					return;
				}
				reject(new Error("FileReader did not return an ArrayBuffer"));
			};
			reader.onerror = () => reject(reader.error ?? new Error("Failed to read blob"));
			reader.readAsArrayBuffer(blob);
		});
	}

	if (typeof Response === "function") {
		return new Response(blob).arrayBuffer();
	}

	return Promise.reject(new Error("No way to read a Blob on this platform"));
};

/**
 * The second rung of the image-cache chain: Cache Storage as a blob store.
 *
 * `caches.open` is called lazily inside each operation, NOT in the constructor:
 * in an insecure context it throws, and opening at construction time would take
 * the whole chain down instead of stepping to the next rung.
 *
 * Last-used time and content type ride in response headers, because Cache
 * Storage stores responses rather than records.
 *
 * Its own module rather than part of `LankaBlobCacheStore`: a separately tested
 * unit, of which the store needs only the constructor.
 */
export class LankaCacheStorageBlobAdapter implements ILankaBlobStoreAdapter {
	private static readonly LAST_USED_HEADER = "x-lanka-last-used";
	private static readonly CONTENT_TYPE_HEADER = "content-type";

	private readonly cacheStorage: CacheStorage;
	private readonly cacheName: string;
	private readonly now: () => number;

	constructor(cacheStorage: CacheStorage, cacheName: string, now: () => number) {
		this.cacheStorage = cacheStorage;
		this.cacheName = cacheName;
		this.now = now;
	}

	public async get(key: string): Promise<ILankaBlobRecord | null> {
		const cache = await this.cacheStorage.open(this.cacheName);
		const response = await cache.match(this.toRequestUrl(key));
		if (!response) return null;

		// Bytes go in and out as an ArrayBuffer rather than a Blob body. A Blob body
		// is the obvious choice but is not honoured everywhere — some engines
		// stringify it — while an ArrayBuffer round-trips identically in every
		// engine that has Cache Storage at all. The content type rides in the
		// header so the Blob can be rebuilt faithfully.
		const buffer = await response.arrayBuffer();
		const type = response.headers.get(LankaCacheStorageBlobAdapter.CONTENT_TYPE_HEADER) ?? "";
		const blob = new Blob([buffer], { type });

		const rawLastUsed = response.headers.get(LankaCacheStorageBlobAdapter.LAST_USED_HEADER);
		const lastUsedAt = rawLastUsed === null ? NaN : Number(rawLastUsed);

		return {
			key,
			blob,
			lastUsedAt: Number.isFinite(lastUsedAt) ? lastUsedAt : this.now(),
			size: blob.size,
		};
	}

	public async put(record: ILankaBlobRecord): Promise<void> {
		const cache = await this.cacheStorage.open(this.cacheName);
		const buffer = await blobToArrayBuffer(record.blob);
		await cache.put(
			this.toRequestUrl(record.key),
			new Response(buffer, {
				headers: {
					[LankaCacheStorageBlobAdapter.LAST_USED_HEADER]: String(record.lastUsedAt),
					[LankaCacheStorageBlobAdapter.CONTENT_TYPE_HEADER]:
						record.blob.type || "application/octet-stream",
				},
			}),
		);
	}

	public async delete(key: string): Promise<void> {
		const cache = await this.cacheStorage.open(this.cacheName);
		await cache.delete(this.toRequestUrl(key));
	}

	public async listByAge(): Promise<ILankaBlobRecord[]> {
		const cache = await this.cacheStorage.open(this.cacheName);
		const requests = await cache.keys();
		const records: ILankaBlobRecord[] = [];
		for (const request of requests) {
			const key = this.fromRequestUrl(request.url);
			const record = await this.get(key);
			if (record) records.push(record);
		}
		return records.sort((left, right) => left.lastUsedAt - right.lastUsedAt);
	}

	public async clear(): Promise<void> {
		await this.cacheStorage.delete(this.cacheName);
	}

	/** Cache Storage keys must be URLs, so an opaque key is encoded into a path. */
	private toRequestUrl(key: string): string {
		return `https://image-cache.invalid/${encodeURIComponent(key)}`;
	}

	private fromRequestUrl(url: string): string {
		const encoded = url.slice(url.lastIndexOf("/") + 1);
		try {
			return decodeURIComponent(encoded);
		} catch {
			return encoded;
		}
	}
}
