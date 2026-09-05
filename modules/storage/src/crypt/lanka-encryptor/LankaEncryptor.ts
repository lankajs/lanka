/**
 * Encrypting, decrypting and hashing values with the browser's own primitives.
 *
 * AES-GCM for encryption, SHA-256 for hashing, all through Web Crypto: the
 * framework must not carry its own cryptography — the platform either has it or
 * does not, and the second is more honest than a hand-rolled substitute.
 *
 * Provides AES-GCM with a fresh IV per value, SHA-256 for the secret and for
 * arbitrary values, and Base64 encoding so ciphertext can be stored as a string.
 *
 * ```ts
 * const encryptor = await createLankaEncryptor("secret");
 * const encrypted = await encryptor.encrypt("hello");
 * const decrypted = await encryptor.decrypt(encrypted);
 * ```
 */
export class LankaEncryptor {
	private secretKey: CryptoKey;
	private encoder = new TextEncoder();
	private decoder = new TextDecoder();
	private hashedSecret: string;
	/** The HMAC key `hashKey` signs with, derived on first use. */
	private hmacKey: Promise<CryptoKey> | null = null;

	/**
	 * Takes a key that is already derived — which is why it is not the way in.
	 *
	 * `createLankaEncryptor(secret)` derives the key and calls this; the
	 * constructor stays public so an application holding a `CryptoKey` of its own
	 * can use it.
	 */
	public constructor(secretKey: CryptoKey, hashedSecret: string) {
		this.secretKey = secretKey;
		this.hashedSecret = hashedSecret;
	}

	/** SHA-256 of the secret, as a hex string. */
	getHashedKey(): string {
		return this.hashedSecret;
	}

	/**
	 * The name a storage key is written under: HMAC-SHA-256, keyed by the secret.
	 *
	 * ## Why it is keyed, and was not
	 *
	 * `LankaCipher` hashes a key NAME because the name says what is stored under
	 * it: `token`, `session`, `user`. It used to be a plain SHA-256, and a plain
	 * hash of a short predictable word is not a disguise — it is a lookup. The
	 * dozen names an application actually uses fit in a dictionary anybody can
	 * build in a second, and the common ones are in published rainbow tables
	 * already. The names were as readable as if they had never been hashed, and
	 * the hashing only made that harder to notice.
	 *
	 * Keyed by the secret, the same table has to be rebuilt per application by
	 * somebody who already has the secret — and somebody who has the secret can
	 * read the values themselves, so the name is no longer the weakest part.
	 *
	 * Deterministic, and it has to be: the storage key is where the value lives,
	 * so a hash that changed between sessions would lose everything written.
	 *
	 * @param key The name to hide
	 */
	async hashKey(key: string): Promise<string> {
		const signature = await crypto.subtle.sign(
			"HMAC",
			await this.signingKey(),
			this.encoder.encode(key),
		);

		return Array.from(new Uint8Array(signature))
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");
	}

	/**
	 * The HMAC key, derived once from the secret's hash.
	 *
	 * Derived here rather than taken by the constructor, so a caller holding a
	 * `CryptoKey` of their own keeps the constructor they already use. A REJECTED
	 * promise is never kept: memoised, one failure would answer every later call
	 * for the life of the encryptor.
	 */
	private signingKey(): Promise<CryptoKey> {
		this.hmacKey ??= crypto.subtle
			.importKey(
				"raw",
				this.encoder.encode(this.hashedSecret),
				{ name: "HMAC", hash: "SHA-256" },
				false,
				["sign"],
			)
			.catch((error: unknown) => {
				this.hmacKey = null;
				throw error;
			});

		return this.hmacKey;
	}

	/**
	 * Encrypts a string with AES-GCM.
	 *
	 * A random twelve-byte IV, encryption with the derived key, the IV prepended
	 * to the ciphertext, and the whole thing Base64-encoded. The IV is stored
	 * alongside deliberately: it is not a secret, decryption needs it, and keeping
	 * it elsewhere means losing it elsewhere.
	 *
	 * @param value What to encrypt
	 * @throws {Error} When the value is empty
	 */
	async encrypt(value: string): Promise<string> {
		if (!value) {
			throw new Error("Value must not be empty");
		}

		const iv = crypto.getRandomValues(new Uint8Array(12));
		const encoded = this.encoder.encode(value);

		const ciphertext = await crypto.subtle.encrypt(
			{ name: "AES-GCM", iv },
			this.secretKey,
			encoded,
		);

		// IV and ciphertext go into one buffer.
		const buffer = new Uint8Array(iv.byteLength + ciphertext.byteLength);
		buffer.set(iv, 0);
		buffer.set(new Uint8Array(ciphertext), iv.byteLength);

		return this.arrayBufferToBase64(buffer);
	}

	/**
	 * Decrypts what {@link encrypt} produced.
	 *
	 * The reverse: Base64 to bytes, the first twelve are the IV, the rest is
	 * decrypted with the stored key.
	 *
	 * Failure returns `null` rather than throwing: corrupt ciphertext and a
	 * foreign key mean the same thing to a reader — "nothing to read" — and
	 * forcing every read into a try block produces an empty catch everywhere.
	 *
	 * @param data The Base64 string {@link encrypt} returned
	 */
	async decrypt(data: string): Promise<string | null> {
		try {
			const raw = this.base64ToUint8Array(data);
			const iv = raw.slice(0, 12);
			const ciphertext = raw.slice(12);

			const decrypted = await crypto.subtle.decrypt(
				{ name: "AES-GCM", iv },
				this.secretKey,
				ciphertext,
			);

			return this.decoder.decode(decrypted);
		} catch {
			// Did not decrypt: wrong key or corrupt data.
			return null;
		}
	}

	/** Bytes to Base64. */
	private arrayBufferToBase64(buffer: Uint8Array): string {
		let binary = "";
		const len = buffer.byteLength;
		for (let i = 0; i < len; i++) {
			binary += String.fromCharCode(buffer[i]);
		}
		return btoa(binary);
	}

	/** Base64 back to bytes. */
	private base64ToUint8Array(base64: string): Uint8Array {
		const binary = atob(base64);
		const len = binary.length;
		const bytes = new Uint8Array(len);
		for (let i = 0; i < len; i++) {
			bytes[i] = binary.charCodeAt(i);
		}
		return bytes;
	}
}
