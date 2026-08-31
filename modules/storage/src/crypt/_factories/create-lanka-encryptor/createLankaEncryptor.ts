import { LankaEncryptor } from "../../lanka-encryptor/LankaEncryptor";

/**
 * Derives the key and answers an encryptor ready to use.
 *
 * A free function rather than a `static create` on the class: a static factory
 * beside a private constructor reads as the anti-pattern §1 of
 * `skills/forms/SKILL.md` bans, and it is not one — but the reader has to work
 * that out. Out here the shape says what it is: key derivation is async, a
 * constructor cannot await, and a half-built encryptor is worse than none.
 *
 * ```ts
 * const encryptor = await createLankaEncryptor("secret");
 * const encrypted = await encryptor.encrypt("hello");
 * ```
 *
 * @param secret The secret the AES-GCM key is derived from
 * @throws {Error} When the secret is empty
 */
export const createLankaEncryptor = async (secret: string): Promise<LankaEncryptor> => {
	if (!secret) {
		throw new Error("Encryption key is required");
	}

	const keyMaterial = new TextEncoder().encode(secret);

	// SHA-256 of the given secret, which then becomes the AES-GCM key.
	const hashBuffer = await crypto.subtle.digest("SHA-256", keyMaterial);

	const secretKey = await crypto.subtle.importKey("raw", hashBuffer, { name: "AES-GCM" }, false, [
		"encrypt",
		"decrypt",
	]);

	// The secret's hash is kept as a string, for comparison and diagnostics.
	const hashedSecret = Array.from(new Uint8Array(hashBuffer))
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");

	return new LankaEncryptor(secretKey, hashedSecret);
};
