import type { StateStorage } from "zustand/middleware";
import { lankaEncryptedStorage } from "../lanka-encrypted-storage/LankaEncryptedStorage";
import { isWebCryptoAvailable } from "../crypt/_utils/is-web-crypto-available/isWebCryptoAvailable";

/**
 * The secret is set by the APPLICATION, not the package.
 *
 * Not `import.meta.env`: that is ONE bundler's global. In node it is
 * `undefined` and reading a property off it throws on first `import`; a webpack
 * consumer would fail the same way. And a shipped fallback secret is one secret
 * shared by every consumer.
 *
 * What the secret is does not change: it is baked into the build and is
 * obfuscation, not protection against XSS on the page itself. It keeps personal
 * data from sitting in localStorage as plain text.
 */
let storageSecret: string | null = null;

/**
 * Sets the encryption secret. Called by the app before the first read or write.
 *
 * Without it `ensureReady` refuses LOUDLY. There is deliberately no default: a
 * shared fallback secret is the absence of encryption disguised as its presence.
 */
export function setLankaStorageSecret(secret: string): void {
	storageSecret = secret;
}

/**
 * Keys left behind by an application's PREVIOUS, unencrypted implementation.
 *
 * Empty by default, and that is the point: another app's history is not a
 * property of this storage. An app with nothing to clean should declare no
 * session key and should not need a bootstrapped framework to write a string to
 * localStorage.
 */
let legacyPlaintextKeys: readonly string[] = [];

/**
 * Declares keys to delete from localStorage when encrypted storage first
 * becomes ready.
 *
 * The deletion is one-shot and safe: `LankaEncryptedStorage` stores values under
 * a hashed key, so these names cannot touch an encrypted record.
 */
export function setLankaLegacyPlaintextKeys(keys: readonly string[]): void {
	legacyPlaintextKeys = [...keys];
}

function requireStorageSecret(): string {
	if (!storageSecret) {
		throw new Error(
			"@lankajs/storage: no encryption secret set. Call setLankaStorageSecret(...) " +
				"before the first use of LankaEncryptedStateStorage. There is no default: a " +
				"shared fallback secret is the absence of encryption that looks like its presence.",
		);
	}
	return storageSecret;
}

/**
 * A zustand `StateStorage` over `LankaEncryptedStorage`: AES-GCM, SHA-256
 * hashed keys, values cached in memory so repeat reads stay fast.
 *
 * **Persistence ladder**
 *
 * 1. **AES-GCM in localStorage** — the normal path.
 * 2. **No persistence at all** — when Web Crypto is unavailable (`crypto.subtle`
 *    needs a secure context, and some WebViews withhold it) or a storage call
 *    fails. The persisted slice then lives only in memory.
 *
 * Falling back to PLAINTEXT localStorage is deliberately not an option: it would
 * silently write personal data in the clear, defeating the reason this storage
 * exists. Losing the convenience is acceptable; losing the property is not.
 *
 * Every method swallows failures because zustand's `persist` turns a rejection
 * here into an unhandled promise rejection during hydration, which reads as a
 * crash on a device whose only problem is "no crypto".
 */
class LankaEncryptedStateStorage implements StateStorage {
	/**
	 * Memoised init: a burst of reads and writes during hydration triggers exactly
	 * one `init`.
	 *
	 * The storage's own guard only flips AFTER the async setup resolves, so without
	 * this memo concurrent callers would race and re-initialise.
	 */
	private readyPromise: Promise<void> | null = null;

	public async getItem(name: string): Promise<string | null> {
		if (!isWebCryptoAvailable()) return null;
		try {
			await this.ensureReady();
			return (await lankaEncryptedStorage.getLocal(name, true)) ?? null;
		} catch {
			// Unreadable — no crypto, corrupt ciphertext, storage denied — is
			// indistinguishable from "nothing stored" as far as hydration cares.
			return null;
		}
	}

	public async setItem(name: string, value: string): Promise<void> {
		if (!isWebCryptoAvailable()) return;
		try {
			await this.ensureReady();
			await lankaEncryptedStorage.setLocal(name, value);
		} catch {
			/* State stays in memory for this run. */
		}
	}

	public async removeItem(name: string): Promise<void> {
		if (!isWebCryptoAvailable()) return;
		try {
			await this.ensureReady();
			await lankaEncryptedStorage.removeLocal(name);
		} catch {
			/* Nothing was persisted, so nothing to remove. */
		}
	}

	private ensureReady(): Promise<void> {
		if (!this.readyPromise) {
			this.readyPromise = lankaEncryptedStorage
				.init(requireStorageSecret())
				.catch((error: unknown) => {
					// Never memoise a REJECTED promise: it would hand the same rejection
					// to every later read and write, disabling persistence permanently
					// after one transient failure.
					this.readyPromise = null;
					throw error;
				})
				.then(() => {
					// One-shot cleanup of plaintext left by the app's previous
					// unencrypted implementation. THE APP declares the list; the package
					// has no history of its own, and the default is empty.
					for (const key of legacyPlaintextKeys) {
						try {
							localStorage.removeItem(key);
						} catch {
							/* localStorage unavailable — nothing to clean */
						}
					}
				});
		}
		// The field is nullable because the catch above may clear it; by here it
		// holds a promise either way, and the assertion says which of the two.
		return this.readyPromise;
	}
}

export const lankaEncryptedStateStorage = new LankaEncryptedStateStorage();
