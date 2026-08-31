import { LankaCipher } from "../crypt/lanka-cipher/LankaCipher";
import { createLankaCipher } from "../crypt/_factories/create-lanka-cipher/createLankaCipher";
import { LankaWebStorageAdapter } from "../_adapters/lanka-web-storage-adapter/LankaWebStorageAdapter";
import { LankaCacheStorageAdapter } from "../_adapters/lanka-cache-storage-adapter/LankaCacheStorageAdapter";
import { LankaStorage } from "../lanka-storage/LankaStorage";

/**
 * The same three storages, with every value encrypted under a key you supply.
 *
 * The ambient one is `lankaEncryptedStorage`. A second vault has its own key and
 * its own key space, so the class is constructed rather than shared: nothing may
 * be read or written until `init` resolves, and there is no default key by
 * design — a default key is not encryption.
 */
export class LankaEncryptedStorage extends LankaStorage {
	// Assigned by `init`, and every read passes `checkInit` first: a cipher
	// cannot exist before a key does, and there is no default key by design.
	private encryptedLocal!: LankaCipher;
	private encryptedSession!: LankaCipher;
	private encryptedCache!: LankaCipher;

	private encryptedLocalCache = new Map<string, string | null>();
	private encryptedSessionCache = new Map<string, string | null>();
	private encryptedCacheCache = new Map<string, string | null>();

	private isInitialized = false;

	async init(secretKey: string, prefix = ""): Promise<void> {
		if (this.isInitialized) return;

		this.encryptedLocal = await createLankaCipher(
			new LankaWebStorageAdapter(localStorage),
			secretKey,
			true,
			prefix,
		);

		this.encryptedSession = await createLankaCipher(
			new LankaWebStorageAdapter(sessionStorage),
			secretKey,
			true,
			prefix,
		);

		this.encryptedCache = await createLankaCipher(
			new LankaCacheStorageAdapter("encrypted_app_cache"),
			secretKey,
			true,
			prefix,
		);

		this.isInitialized = true;
	}

	private checkInit() {
		if (!this.isInitialized) {
			throw new Error("LankaEncryptedStorage is not initialized. Call init() first.");
		}
	}

	// ---- Overrides: LocalStorage ----

	async setLocal(key: string, value: string): Promise<void> {
		this.checkInit();
		await this.runTransaction(this.encryptedLocal, this.encryptedLocalCache, key, value);
	}

	async getLocal(key: string, isCareful: boolean = false): Promise<string | null> {
		this.checkInit();
		return await this.readThroughCache(
			this.encryptedLocal,
			this.encryptedLocalCache,
			key,
			isCareful,
		);
	}

	async removeLocal(key: string): Promise<void> {
		this.checkInit();
		await this.runTransaction(this.encryptedLocal, this.encryptedLocalCache, key, null);
	}

	async clearLocal(): Promise<void> {
		this.checkInit();
		try {
			await Promise.all([
				this.encryptedLocal.clear(),
				Promise.resolve(this.encryptedLocalCache.clear()),
			]);
		} catch (e) {
			this.encryptedLocalCache.clear();
			throw e;
		}
	}

	// ---- Overrides: SessionStorage ----

	async setSession(key: string, value: string): Promise<void> {
		this.checkInit();
		await this.runTransaction(this.encryptedSession, this.encryptedSessionCache, key, value);
	}

	async getSession(key: string, isCareful: boolean = false): Promise<string | null> {
		this.checkInit();
		return await this.readThroughCache(
			this.encryptedSession,
			this.encryptedSessionCache,
			key,
			isCareful,
		);
	}

	async removeSession(key: string): Promise<void> {
		this.checkInit();
		await this.runTransaction(this.encryptedSession, this.encryptedSessionCache, key, null);
	}

	async clearSession(): Promise<void> {
		this.checkInit();
		try {
			await Promise.all([
				this.encryptedSession.clear(),
				Promise.resolve(this.encryptedSessionCache.clear()),
			]);
		} catch (e) {
			this.encryptedSessionCache.clear();
			throw e;
		}
	}

	// ---- Overrides: CacheStorage ----

	async setCache(key: string, value: string): Promise<void> {
		this.checkInit();
		await this.runTransaction(this.encryptedCache, this.encryptedCacheCache, key, value);
	}

	async getCache(key: string, isCareful: boolean = false): Promise<string | null> {
		this.checkInit();
		return await this.readThroughCache(
			this.encryptedCache,
			this.encryptedCacheCache,
			key,
			isCareful,
		);
	}

	async removeCache(key: string): Promise<void> {
		this.checkInit();
		await this.runTransaction(this.encryptedCache, this.encryptedCacheCache, key, null);
	}

	async clearCache(): Promise<void> {
		this.checkInit();
		try {
			await Promise.all([
				this.encryptedCache.clear(),
				Promise.resolve(this.encryptedCacheCache.clear()),
			]);
		} catch (e) {
			this.encryptedCacheCache.clear();
			throw e;
		}
	}
}

/** The one every caller wants. `init(secret)` before the first read: the cipher cannot exist without a key, and there is no default key by design. */
export const lankaEncryptedStorage = new LankaEncryptedStorage();
