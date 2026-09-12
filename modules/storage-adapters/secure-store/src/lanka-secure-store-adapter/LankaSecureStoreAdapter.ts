import type { ILankaStorageAdapter } from "lanka/storage";
import type { ILankaSecureStoreEngine } from "../_interfaces/ILankaSecureStoreEngine";
import { fromKeychainKey, toKeychainKey } from "../_utils/keychain-key-codec/keychainKeyCodec";

/**
 * The row this adapter keeps for itself, and the only one that is not a caller's.
 *
 * Encoded like any other key, so it is legal in the keychain, and named so that
 * a developer reading the device's keychain can tell what it is.
 */
const INDEX_KEY = "lanka.secure-store.index";

/** What a keychain will hold in one row, in bytes. iOS has refused more. */
const MAX_VALUE_BYTES = 2048;

/**
 * The keychain behind `ILankaStorageAdapter`.
 *
 * `expo-secure-store` publishes three calls: read a key, write a key, delete a
 * key. The port asks for two more — empty everything, say what is held — and
 * both of them are what a sign-out needs. This adapter is where that difference
 * is paid, once, instead of in every application that reaches for a keychain.
 *
 * ## The index
 *
 * A row of this adapter's own, holding the keychain keys it has written — the
 * ENCODED spelling, so the index says what is actually in the keychain and
 * `keys()` decodes on the way out. Every write updates it, which is one extra
 * keychain call per operation. That is the price
 * of `clear()` being TRUE: without it a sign-out could only delete keys the
 * caller happened to name, and a token nobody remembered would outlive the
 * session that created it.
 *
 * It is read from the engine on each mutation rather than cached, so a second
 * adapter over the same keychain — a per-tenant instance, a test — sees what the
 * first one wrote. Two adapters WRITING at the same instant is the case it does
 * not cover, and on a device there is one process.
 *
 * ## Why values are refused rather than split
 *
 * Above the ceiling the adapter rejects. Splitting a value across rows would
 * make this a filesystem with a keychain underneath, and the failure that hides
 * — half a token read back as a whole one — is worse than the one it prevents.
 * A session token fits; a value that does not belongs somewhere else.
 */
export class LankaSecureStoreAdapter implements ILankaStorageAdapter {
	private readonly engine: ILankaSecureStoreEngine;

	public constructor(engine: ILankaSecureStoreEngine) {
		this.engine = engine;
	}

	private async readIndex(): Promise<string[]> {
		const raw = await this.engine.getItemAsync(toKeychainKey(INDEX_KEY));
		if (raw === null) return [];

		// A keychain a previous version of an application wrote into can hold
		// anything under this name. Unreadable is treated as empty rather than
		// throwing on every call afterwards: the worst case is a `clear()` that
		// misses rows nobody can name any more.
		try {
			const parsed: unknown = JSON.parse(raw);
			return Array.isArray(parsed) ? parsed.filter((one) => typeof one === "string") : [];
		} catch {
			return [];
		}
	}

	private async writeIndex(keys: readonly string[]): Promise<void> {
		await this.engine.setItemAsync(toKeychainKey(INDEX_KEY), JSON.stringify(keys));
	}

	public async getItem(key: string): Promise<string | null> {
		return await this.engine.getItemAsync(toKeychainKey(key));
	}

	public async setItem(key: string, value: string): Promise<void> {
		const size = new TextEncoder().encode(value).length;
		if (size > MAX_VALUE_BYTES) {
			throw new Error(
				`This value is ${String(size)} bytes and a keychain row holds about ` +
					`${String(MAX_VALUE_BYTES)}. Store it elsewhere and keep its address here — ` +
					"a value truncated by the platform reads back as a whole one.",
			);
		}

		const encoded = toKeychainKey(key);
		await this.engine.setItemAsync(encoded, value);

		const index = await this.readIndex();
		// Written once however many times the key is: clause 6 says `keys()`
		// answers what was written, not how often.
		if (!index.includes(encoded)) await this.writeIndex([...index, encoded]);
	}

	public async removeItem(key: string): Promise<void> {
		const encoded = toKeychainKey(key);
		await this.engine.deleteItemAsync(encoded);

		const index = await this.readIndex();
		if (index.includes(encoded)) await this.writeIndex(index.filter((one) => one !== encoded));
	}

	public async clear(): Promise<void> {
		// Reads the index rather than the keychain, because the keychain cannot be
		// read: this empties what THIS adapter wrote and leaves rows belonging to
		// the rest of the application alone.
		for (const encoded of await this.readIndex()) {
			await this.engine.deleteItemAsync(encoded);
		}

		await this.engine.deleteItemAsync(toKeychainKey(INDEX_KEY));
	}

	/**
	 * What this adapter wrote, in the spelling it was written with.
	 *
	 * The index holds keychain keys, so this is where clause 11 is actually kept:
	 * a caller that wrote `"with space"` is answered `"with space"` and never the
	 * `with_0020space` the keychain has underneath.
	 */
	public async keys(): Promise<string[]> {
		return (await this.readIndex()).map(fromKeychainKey);
	}
}
