import { describe, it, expect, beforeEach } from "vitest";
import { LankaEncryptor } from "./LankaEncryptor";
import { createLankaEncryptor } from "../_factories/create-lanka-encryptor/createLankaEncryptor";

describe("LankaEncryptor", () => {
	let encryptor: LankaEncryptor;

	beforeEach(async () => {
		encryptor = await createLankaEncryptor("my-secret");
	});

	it("should create an instance and return hashed key", () => {
		const hash = encryptor.getHashedKey();
		expect(hash).toMatch(/[0-9a-f]{64}/);
	});

	it("should hash a key correctly", async () => {
		const hash = await encryptor.hashKey("test-key");
		expect(hash).toHaveLength(64);
		expect(hash).toMatch(/[0-9a-f]{64}/);
	});

	it("should encrypt and decrypt a value", async () => {
		const plaintext = "hello world";
		const encrypted = await encryptor.encrypt(plaintext);
		expect(typeof encrypted).toBe("string");
		const decrypted = await encryptor.decrypt(encrypted);
		expect(decrypted).toBe(plaintext);
	});

	it("should return null for invalid decryption", async () => {
		const result = await encryptor.decrypt("invalid-data");
		expect(result).toBeNull();
	});

	it("should throw error when creating with empty secret", async () => {
		await expect(createLankaEncryptor("")).rejects.toThrow("Encryption key is required");
	});

	it("should throw error when encrypting empty value", async () => {
		await expect(encryptor.encrypt("")).rejects.toThrow("Value must not be empty");
	});

	it("stress: repeated encrypt/decrypt", async () => {
		const plaintext = "stress-test-value";
		for (let i = 0; i < 1000; i++) {
			const encrypted = await encryptor.encrypt(plaintext);
			const decrypted = await encryptor.decrypt(encrypted);
			expect(decrypted).toBe(plaintext);
		}
	});

	it("stress: repeated hashKey calls", async () => {
		for (let i = 0; i < 1000; i++) {
			const hash = await encryptor.hashKey(`key-${i}`);
			expect(hash).toHaveLength(64);
		}
	});
});

/** Plain SHA-256 as hex — the scheme `hashKey` used to be, and an attacker's dictionary. */
const sha256Hex = async (text: string): Promise<string> => {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
	return Array.from(new Uint8Array(digest))
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
};

/**
 * A storage key name is hashed to keep it out of a reader's sight — that is the
 * whole reason `LankaCipher` hashes it rather than writing "token" in the clear.
 *
 * An UNKEYED hash does not do that. Key names are short and predictable — `token`,
 * `user`, `session`, `refreshToken` — so a plain SHA-256 of one is a lookup in a
 * table anybody can build, and a rainbow table already has. The names were as
 * readable as if they had never been hashed; the hashing only made that harder to
 * notice.
 */
describe("LankaEncryptor — hashing a storage key name", () => {
	it("is NOT the plain hash anyone can compute", async () => {
		const encryptor = await createLankaEncryptor("my-secret");

		const hashed = await encryptor.hashKey("token");

		expect(hashed).not.toBe(await sha256Hex("token"));
	});

	it("differs per secret, so one dictionary does not open two applications", async () => {
		const first = await createLankaEncryptor("first-secret");
		const second = await createLankaEncryptor("second-secret");

		expect(await first.hashKey("token")).not.toBe(await second.hashKey("token"));
	});

	it("is the same in the next session, or nothing written could be read back", async () => {
		const before = await createLankaEncryptor("my-secret");
		const after = await createLankaEncryptor("my-secret");

		expect(await after.hashKey("token")).toBe(await before.hashKey("token"));
	});

	it("still separates two names under one secret", async () => {
		const encryptor = await createLankaEncryptor("my-secret");

		expect(await encryptor.hashKey("token")).not.toBe(await encryptor.hashKey("user"));
	});
});
