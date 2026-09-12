import type { ILankaStorageAdapter } from "lanka/storage";
import { LankaEncryptor } from "../lanka-encryptor/LankaEncryptor";
import { sha256Hex } from "../_utils/sha256-hex/sha256Hex";

/**
 * Everything a cipher writes sits under this, and `clear()` removes exactly it.
 *
 * Without a marker of its own a cipher cannot tell its entries from the page's:
 * with encryption on they are bare hashes, and with a caller's prefix they are
 * still mixed in with whatever else that prefix covers. `clear()` had no way to
 * be selective and emptied the whole store instead.
 */
const NAMESPACE = "lanka.cipher.";

/** What the previous scheme wrote under: sixty-four lower-case hex characters. */
const LEGACY_HASHED_KEY = /^[0-9a-f]{64}$/;

/** A store that can list what it holds — see `ILankaAsyncStorageAdapter.keys`. */
type TEnumerableAdapter = ILankaStorageAdapter & { keys: () => Promise<string[]> };

/**
 * Narrows an adapter to one that can be asked what it holds.
 *
 * Asked rather than assumed: `keys` is an optional capability, and a store that
 * lacks it is not broken — it just leaves `clear()` no choice but to empty
 * itself.
 */
const canEnumerate = (adapter: ILankaStorageAdapter): adapter is TEnumerableAdapter =>
	typeof (adapter as Partial<TEnumerableAdapter>).keys === "function";

/**
 * Wraps any storage adapter, encrypting values transparently for the caller.
 *
 * Values are encrypted with AES-GCM and KEYS are hashed: a key name in storage
 * tells you what is stored under it, so leaving it in the clear leaves half the
 * information outside. The hash is KEYED by the secret — an unkeyed one is a
 * dictionary lookup for the handful of names an application uses, which is no
 * disguise at all. See `LankaEncryptor.hashKey`.
 *
 * The adapter is injected, so encryption does not know where it writes. Keys and
 * values are cached in memory — hashing and decryption cost measurably and the
 * same entries are read many times. With encryption disabled, values are written
 * as-is.
 *
 * ## Upgrading from the previous key scheme
 *
 * An entry written before the hash was keyed lives under a different name. It is
 * carried over on the first READ of that key — the value is rewritten under the
 * new name and the old entry removed — so an application upgrading loses
 * nothing: whatever it reads at start-up migrates itself. `clear()` sweeps the
 * old shape as well, so a sign-out leaves nothing behind either.
 *
 * What is NOT carried over is a key nothing ever reads again. Those stay until
 * the next `clear()`, encrypted and unreachable, which is what they already were.
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
	/** Everything this cipher owns starts with it: the caller's prefix, then ours. */
	private readonly scope: string;
	/**
	 * Names already looked up under the previous scheme.
	 *
	 * So the extra read costs once per name rather than once per miss: a key that
	 * is simply absent would otherwise be looked for twice on every read, for the
	 * life of the session.
	 */
	private readonly carried = new Set<string>();

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
		this.scope = keyPrefix + NAMESPACE;
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
			return this.adapter.setItem(this.scope + key, value);
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
			return this.read(key, this.scope + key, this.keyPrefix + key);
		}

		if (this.valueCache.has(key)) {
			return this.valueCache.get(key)!;
		}

		const encrypted = await this.read(
			key,
			await this.getHashedKey(key),
			await this.getLegacyKey(key),
		);
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

		// Both names: a caller removing a key that was never read since the
		// upgrade would otherwise leave the previous scheme's copy in place, and
		// the value they asked to forget would still be there.
		if (!this.isEncryptionEnabled) {
			await this.adapter.removeItem(this.scope + key);
			return this.adapter.removeItem(this.keyPrefix + key);
		}

		await this.adapter.removeItem(await this.getHashedKey(key));
		return this.adapter.removeItem(await this.getLegacyKey(key));
	}

	/**
	 * Removes everything THIS cipher wrote, together with the in-memory caches.
	 *
	 * It used to empty the adapter outright, which for `localStorage` is the whole
	 * page: the theme, the language, the consent record, another library's data
	 * and the release guard's version — none of it this cipher's, all of it gone
	 * because somebody signed out.
	 *
	 * A store that cannot list its keys still gets the old behaviour, and that is
	 * the right answer there rather than a fallback: the one such adapter that
	 * ships, Cache Storage, owns a whole named cache, so emptying it IS removing
	 * only what this cipher wrote.
	 */
	async clear(): Promise<void> {
		this.keyCache.clear();
		this.valueCache.clear();
		this.carried.clear();

		if (!canEnumerate(this.adapter)) return this.adapter.clear();

		for (const key of await this.ownKeys(this.adapter)) {
			await this.adapter.removeItem(key);
		}
	}

	/** Every key in the store that belongs to this cipher, current or previous. */
	private async ownKeys(adapter: TEnumerableAdapter): Promise<string[]> {
		return (await adapter.keys()).filter((key) => this.owns(key));
	}

	/**
	 * Whether a key in the store is one of ours.
	 *
	 * The previous scheme left no marker, so it is recognised by SHAPE: exactly
	 * sixty-four hex characters under our caller's prefix is what it wrote and
	 * what nothing else writes. That is a judgement, and it is the conservative
	 * one — the behaviour it replaces deleted every key in the store without
	 * looking at any of them.
	 *
	 * Only while encryption is ON. Unencrypted, the previous scheme wrote the key
	 * NAME, which is indistinguishable from a key the application put there
	 * itself — so those are left alone.
	 */
	private owns(key: string): boolean {
		if (key.startsWith(this.scope)) return true;
		if (!this.isEncryptionEnabled) return false;

		return (
			key.startsWith(this.keyPrefix) &&
			LEGACY_HASHED_KEY.test(key.slice(this.keyPrefix.length))
		);
	}

	/**
	 * The stored value, taking over an entry the previous scheme wrote.
	 *
	 * The carry-over happens on READ because that is the only moment both names
	 * are known: the previous scheme's key cannot be enumerated, so there is no
	 * pass over the store that would find it.
	 */
	private async read(key: string, currentKey: string, legacyKey: string): Promise<string | null> {
		const stored = await this.adapter.getItem(currentKey);
		if (stored !== null) return stored;

		if (this.carried.has(key)) return null;
		this.carried.add(key);

		const previous = await this.adapter.getItem(legacyKey);
		if (previous === null) return null;

		await this.adapter.setItem(currentKey, previous);
		await this.adapter.removeItem(legacyKey);
		return previous;
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
		hashed = this.scope + hashOnly;
		this.keyCache.set(key, hashed);
		return hashed;
	}

	/** The name this key was written under before the hash was keyed. */
	private async getLegacyKey(key: string): Promise<string> {
		return this.keyPrefix + (await sha256Hex(key));
	}
}
