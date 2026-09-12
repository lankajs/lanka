import type { ILankaAsyncStorageAdapter } from "lanka/storage";
import { requireWebEngine } from "../../_utils/require-web-engine/requireWebEngine";

/**
 * The CacheStorage API, as one of the three handlers `LankaStorage` takes.
 *
 * Published because building a `LankaStorage` of your own means handing it
 * handlers, and these are the ones the ambient instance uses. Substituting one is
 * how a test — or a platform without the API — puts something else behind the
 * same calls.
 */
export class LankaCacheStorageAdapter implements ILankaAsyncStorageAdapter {
	private cacheName: string;
	private cachePromise: Promise<Cache>;

	constructor(cacheName: string) {
		this.cacheName = cacheName;
		// Asked once, here, because the constructor is where the answer is needed:
		// `caches` is a browser API and this adapter is a browser adapter. Off a
		// page the application hands `LankaStorage` a different handler, and this
		// class is never built.
		this.cachePromise = requireWebEngine(
			typeof caches === "undefined" ? undefined : caches,
			"caches",
			"cache",
		).open(this.cacheName);
	}

	private async getCache(): Promise<Cache> {
		return this.cachePromise;
	}

	async setItem(key: string, value: string): Promise<void> {
		const cache = await this.getCache();
		await cache.put(key, new Response(value));
	}

	async getItem(key: string): Promise<string | null> {
		const cache = await this.getCache();
		const response = await cache.match(key);
		return response ? response.text() : null;
	}

	async removeItem(key: string): Promise<void> {
		const cache = await this.getCache();
		await cache.delete(key);
	}

	async clear(): Promise<void> {
		await caches.delete(this.cacheName);
		this.cachePromise = caches.open(this.cacheName);
	}
}
