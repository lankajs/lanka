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
	 * SHA-256 of an arbitrary string.
	 *
	 * @param key What to hash
	 */
	async hashKey(key: string): Promise<string> {
		const data = this.encoder.encode(key);
		const hashBuffer = await crypto.subtle.digest("SHA-256", data);
		return Array.from(new Uint8Array(hashBuffer))
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");
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
