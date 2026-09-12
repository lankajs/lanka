import { describe, expect, it } from "vitest";
import { fromKeychainKey, toKeychainKey } from "./keychainKeyCodec";

/** What the keychain accepts, and nothing else. */
const KEYCHAIN_SAFE = /^[A-Za-z0-9._-]*$/;

describe("keychainKeyCodec", () => {
	const KEYS = [
		"session.token",
		"session_token",
		"with space",
		"with/slash",
		"with:colon",
		"with?query=1",
		"UPPER_and_lower",
		"-leading-dash",
		"naïve-café",
		"🔐",
		"",
		"____",
		"_0020",
	];

	it("produces a key the keychain will take, whatever it was given", () => {
		for (const key of KEYS) {
			expect(toKeychainKey(key), key).toMatch(KEYCHAIN_SAFE);
		}
	});

	it("gives back exactly what it was handed", () => {
		for (const key of KEYS) {
			expect(fromKeychainKey(toKeychainKey(key)), key).toBe(key);
		}
	});

	it("escapes the escape, or a literal underscore would decode as something else", () => {
		// `_0020` is what a space encodes to. A key that CONTAINS that text must
		// not come back as a space, and that is only true while `_` escapes itself.
		expect(fromKeychainKey(toKeychainKey("_0020"))).toBe("_0020");
		expect(fromKeychainKey(toKeychainKey(" "))).toBe(" ");
		expect(toKeychainKey("_0020")).not.toBe(toKeychainKey(" "));
	});

	it("leaves a key that was already safe untouched", () => {
		// The common case pays nothing: a namespaced key is legal as written.
		expect(toKeychainKey("session.token")).toBe("session.token");
		expect(toKeychainKey("a-b.c")).toBe("a-b.c");
	});

	it("never maps two keys onto one", () => {
		const encoded = KEYS.map(toKeychainKey);

		expect(new Set(encoded).size, "one keychain key per key").toBe(KEYS.length);
	});

	it("keeps a surrogate pair whole", () => {
		// Two escapes out, one character back. Encoding by code point would have
		// produced an escape the decoder could not size.
		expect(toKeychainKey("🔐")).toHaveLength(10);
		expect(fromKeychainKey(toKeychainKey("🔐"))).toBe("🔐");
	});
});
