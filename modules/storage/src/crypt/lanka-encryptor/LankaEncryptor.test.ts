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
