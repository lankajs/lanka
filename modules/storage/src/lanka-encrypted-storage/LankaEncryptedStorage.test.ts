import { describe, it, expect, beforeEach, vi } from "vitest";
import { lankaEncryptedStorage } from "./LankaEncryptedStorage";
import { installLankaCacheStoragePolyfill } from "../cache-storage-polyfill/installLankaCacheStoragePolyfill";

vi.mock("../crypt/_factories/create-lanka-cipher/createLankaCipher", () => ({
	createLankaCipher: vi.fn().mockImplementation(async () => ({
		setItem: vi.fn(),
		getItem: vi.fn().mockResolvedValue(null),
		removeItem: vi.fn(),
		clear: vi.fn(),
	})),
}));

describe("LankaEncryptedStorage", () => {
	beforeEach(() => {
		// The Cache Storage polyfill is installed EXPLICITLY: installing it on module
		// import would make a bare `import` of the package fail in node. jsdom has no
		// `caches`, so it is required here.
		installLankaCacheStoragePolyfill();
		localStorage.clear();
		sessionStorage.clear();

		lankaEncryptedStorage["isInitialized"] = false;

		lankaEncryptedStorage["encryptedLocalCache"].clear();

		lankaEncryptedStorage["encryptedSessionCache"].clear();

		lankaEncryptedStorage["encryptedCacheCache"].clear();
	});

	it("should throw if not initialized", async () => {
		await expect(lankaEncryptedStorage.getLocal("key")).rejects.toThrow(
			"LankaEncryptedStorage is not initialized. Call init() first.",
		);
	});

	it("should initialize successfully", async () => {
		await lankaEncryptedStorage.init("secret");
		expect(lankaEncryptedStorage["isInitialized"]).toBe(true);
	});

	it("stress: repeated set/get local values", async () => {
		await lankaEncryptedStorage.init("secret");

		for (let i = 0; i < 100; i++) {
			await lankaEncryptedStorage.setLocal(`k${i}`, `v${i}`);
			const val = await lankaEncryptedStorage.getLocal(`k${i}`);
			expect(val).toBe(`v${i}`);
		}
	});
});
