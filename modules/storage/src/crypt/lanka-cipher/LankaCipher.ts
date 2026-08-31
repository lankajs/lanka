import { ILankaStorageAdapter } from "../../_interfaces/ILankaStorageAdapter";
import { LankaEncryptor } from "../lanka-encryptor/LankaEncryptor";

/**
 * Wraps any storage adapter, encrypting values transparently for the caller.
 *
 * Values are encrypted with AES-GCM and KEYS are hashed: a key name in storage
 * tells you what is stored under it, so leaving it in the clear leaves half the
 * information outside.
 *
 * The adapter is injected, so encryption does not know where it writes. Keys and
 * values are cached in memory — hashing and decryption cost measurably and the
 * same entries are read many times. With encryption disabled, values are written
 * as-is.
 *
 * ```ts
 * const storage = await createLankaCipher(adapter, "secret", true);
 * await storage.setItem("token", "12345");
 * const value = await storage.getItem("token");
 * ```
 */
export class LankaCipher {
	private readonly adapter: ILankaStorageAdapter;
	private readonly encryptor: LankaEncryptor;
	private readonly isEncryptionEnabled: boolean;
	private readonly keyCache = new Map<string, string>();
	private readonly valueCache = new Map<string, string>();
	private readonly keyPrefix: string;

	/**
	 * @param adapter Where to write
	 * @param encryptor What hashes keys and encrypts values
	 * @param isEncryptionEnabled When off, values are written as-is
	 * @param keyPrefix Prefix for storage keys
	 */
	public constructor(
		adapter: ILankaStorageAdapter,
		encryptor: LankaEncryptor,
		isEncryptionEnabled = true,
		keyPrefix = "",
	) {
		this.adapter = adapter;
		this.encryptor = encryptor;
		this.isEncryptionEnabled = isEncryptionEnabled;
		this.keyPrefix = keyPrefix;
	}

	/**
	 * Stores a value under a key, encrypting it when encryption is on.
	 *
	 * @param key Storage key
	 * @param value What to store
	 * @throws {Error} When the key or the value is empty
	 */
	async setItem(key: string, value: string): Promise<void> {
		if (!key || !value) throw new Error("Key and value must not be empty");

		if (!this.isEncryptionEnabled) {
			return this.adapter.setItem(this.keyPrefix + key, value);
		}

		const hashedKey = await this.getHashedKey(key);
		const encrypted = await this.encryptor.encrypt(value);

		this.valueCache.set(key, value);
		return this.adapter.setItem(hashedKey, encrypted);
	}

	/**
	 * Reads a value, decrypting it when encryption is on.
	 *
	 * @param key Storage key
	 * @returns The value, or `null` when there is none
	 * @throws {Error} When the key is empty
	 */
	async getItem(key: string): Promise<string | null> {
		if (!key) throw new Error("Key must not be empty");

		if (!this.isEncryptionEnabled) {
			return this.adapter.getItem(this.keyPrefix + key);
		}

		if (this.valueCache.has(key)) {
			return this.valueCache.get(key)!;
		}

		const hashedKey = await this.getHashedKey(key);
		const encrypted = await this.adapter.getItem(hashedKey);
		if (!encrypted) return null;

		const decrypted = await this.encryptor.decrypt(encrypted);
		if (decrypted !== null) {
			this.valueCache.set(key, decrypted);
		}
		return decrypted;
	}

	/**
	 * Removes a value from storage.
	 *
	 * @param key Storage key
	 * @throws {Error} When the key is empty
	 */
	async removeItem(key: string): Promise<void> {
		if (!key) throw new Error("Key must not be empty");

		this.valueCache.delete(key);

		if (!this.isEncryptionEnabled) {
			return this.adapter.removeItem(this.keyPrefix + key);
		}

		return this.adapter.removeItem(await this.getHashedKey(key));
	}

	/** Clears the whole store together with the in-memory caches. */
	async clear(): Promise<void> {
		this.keyCache.clear();
		this.valueCache.clear();
		return this.adapter.clear();
	}

	/**
	 * The key's hash, from the cache or computed for the first time.
	 *
	 * @param key The original key
	 */
	private async getHashedKey(key: string): Promise<string> {
		let hashed = this.keyCache.get(key);
		if (hashed) return hashed;

		const hashOnly = await this.encryptor.hashKey(key);
		hashed = this.keyPrefix + hashOnly;
		this.keyCache.set(key, hashed);
		return hashed;
	}
}
