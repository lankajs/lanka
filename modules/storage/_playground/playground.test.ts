import { beforeEach, describe, expect, it } from "vitest";
import { createLankaIdRegistry, LankaIdRegistry } from "../src/index";
import { lankaStorage } from "../src/index";
import { createLankaCipher, createLankaEncryptor, LankaCipher, LankaEncryptor } from "../src/index";
import {
	createPlaygroundMemoryAdapter,
	createPlaygroundTenantStorage,
	createPlaygroundReadMarks,
	createPlaygroundSecretNotes,
	createPlaygroundSession,
	startPlaygroundStorage,
} from "./app";

/**
 * The package, used as a session uses it.
 *
 * The point is the LIFETIMES: what must survive a reload, what must not, and
 * what may vanish. A unit test proves each storage reads back what it wrote;
 * this proves an application can tell them apart.
 */
beforeEach(async () => {
	startPlaygroundStorage();
	localStorage.clear();
	sessionStorage.clear();
	// The cache storage is neither of those and is not cleared with them: the
	// package keeps a read-through memory cache in front of it, so a test that
	// forgot this would read the previous test's feed.
	await lankaStorage.clearCache();
});

describe("the storage playground", () => {
	it("keeps a preference across a reload", async () => {
		const session = createPlaygroundSession();

		await session.savePreferences({ theme: "dark", language: "en" });

		// A new session object is a new page: nothing is carried in memory.
		expect(await createPlaygroundSession().readPreferences()).toEqual({
			theme: "dark",
			language: "en",
		});
	});

	it("keeps a draft within the tab", async () => {
		const session = createPlaygroundSession();

		await session.saveDraft("half a sentence");

		expect(await session.readDraft()).toBe("half a sentence");
	});

	it("discards a draft on request", async () => {
		const session = createPlaygroundSession();
		await session.saveDraft("half a sentence");

		await session.discardDraft();

		expect(await session.readDraft()).toBeNull();
	});

	it("caches a derived list and reads it back", async () => {
		const session = createPlaygroundSession();

		await session.cacheFeed(["a", "b"]);

		expect(await session.readFeed()).toEqual(["a", "b"]);
	});

	it("signing out clears the session and the preference", async () => {
		const session = createPlaygroundSession();
		await session.savePreferences({ theme: "dark", language: "en" });
		await session.saveDraft("half a sentence");

		await session.signOut();

		expect(await session.readPreferences()).toBeNull();
		expect(await session.readDraft()).toBeNull();
	});

	it("answers nothing for what was never written", async () => {
		const session = createPlaygroundSession();

		expect(await session.readPreferences()).toBeNull();
		expect(await session.readDraft()).toBeNull();
		expect(await session.readFeed()).toBeNull();
	});
});

describe("the read-marks playground", () => {
	it("remembers what was read", async () => {
		const marks = createPlaygroundReadMarks();

		await marks.markRead("post-42");

		expect(await marks.isRead("post-42")).toBe(true);
		expect(await marks.isRead("post-43")).toBe(false);
	});

	it("counts each id once, however often it is marked", async () => {
		const marks = createPlaygroundReadMarks();

		await marks.markRead("post-42");
		await marks.markRead("post-42");

		expect(marks.size).toBe(1);
	});

	it("hands every id back exactly as it went in", async () => {
		// The registry stores numbers. A round trip that changed an id would make
		// the marks silently apply to the wrong posts.
		const marks = createPlaygroundReadMarks();
		const ids = ["post-1", "a-very-long-uuid-like-identifier-0000", "mixed-42"];

		for (const id of ids) await marks.markRead(id);

		expect(marks.all().sort()).toEqual([...ids].sort());
	});
});

describe("a note that must not sit in the clear", () => {
	it("reads back what it wrote, through the cipher", async () => {
		const notes = createPlaygroundSecretNotes("a-secret-this-app-owns");
		await notes.open();

		await notes.write("the visitor wrote this");

		expect(await notes.read()).toBe("the visitor wrote this");
	});

	it("leaves nothing readable under the plain key", async () => {
		const notes = createPlaygroundSecretNotes("a-secret-this-app-owns");
		await notes.open();

		await notes.write("the visitor wrote this");

		// The key is hashed and the value is AES-GCM: a reader of localStorage
		// finds neither the name nor the text. Falling back to plaintext is
		// deliberately not an option — it would look like encryption and be none.
		const raw = JSON.stringify(globalThis.localStorage);
		expect(raw).not.toContain("the visitor wrote this");
		expect(raw).not.toContain("playground-note");
	});

	it("packs a set of long ids into one number", () => {
		const notes = createPlaygroundSecretNotes("a-secret-this-app-owns");

		const packed = notes.packIds(["7f3c-aa", "9d1e-bb", "4b22-cc"]);

		// A thousand string ids fill a quota; the number they become does not.
		expect(packed.length).toBeLessThan("7f3c-aa9d1e-bb4b22-cc".length);
	});
});

describe("a storage of one's own", () => {
	it("keeps what a tenant wrote away from the ambient one", async () => {
		const tenant = createPlaygroundTenantStorage("acme");

		await tenant.setLocal("theme", "dark");
		await lankaStorage.setLocal("theme", "light");

		// Two spaces, two answers. While this was a namespace of statics there was
		// one of each, and an application needing a second had no way to ask.
		expect(await tenant.getLocal("theme")).toBe("dark");
		expect(await lankaStorage.getLocal("theme")).toBe("light");
	});

	it("gives every tenant its own", async () => {
		const acme = createPlaygroundTenantStorage("acme");
		const globex = createPlaygroundTenantStorage("globex");

		await acme.setLocal("plan", "pro");

		expect(await globex.getLocal("plan")).toBe(null);
	});
});

describe("a second encrypted storage", () => {
	it("keeps its own space, under its own key", async () => {
		const notes = createPlaygroundSecretNotes("a-secret-this-app-owns");
		await notes.open();

		await notes.write("what the page wrote");
		await notes.writeToVault("what the vault holds");

		// Two ciphers, two key spaces. The ambient instance is the one every
		// caller wants; the class is how an application asks for a second.
		expect(await notes.read()).toBe("what the page wrote");
		expect(await notes.readFromVault()).toBe("what the vault holds");
	});
});

describe("either style builds the same id registry", () => {
	it("encodes the same id to the same number", async () => {
		const built = createLankaIdRegistry();
		const constructed = new LankaIdRegistry();

		expect(await built.encode("7f3c-aa")).toBe(await constructed.encode("7f3c-aa"));
	});
});

describe("encrypting something that is not going into storage", () => {
	it("hands back a ready encryptor, and refuses an empty secret", async () => {
		const encryptor = await createLankaEncryptor("a-secret-this-app-owns");

		const sealed = await encryptor.encrypt("hello");

		// The key derivation is async, so the way in is a function rather than a
		// constructor — and the class is still a class, for a caller that already
		// holds a `CryptoKey`.
		expect(sealed).not.toBe("hello");
		expect(await encryptor.decrypt(sealed)).toBe("hello");

		await expect(createLankaEncryptor("")).rejects.toThrow("Encryption key is required");
	});
});

describe("an encryptor built around a key the application already holds", () => {
	it("reads what the derived one wrote", async () => {
		const secret = "a-secret-this-app-owns";
		const derived = await createLankaEncryptor(secret);

		// The other way in, and the reason the constructor is public: an
		// application that derived its own `CryptoKey` — from a passphrase, from a
		// key exchange, from a device store — hands it over instead of a string.
		const material = new TextEncoder().encode(secret);
		const hashBuffer = await crypto.subtle.digest("SHA-256", material);
		const key = await crypto.subtle.importKey("raw", hashBuffer, { name: "AES-GCM" }, false, [
			"encrypt",
			"decrypt",
		]);
		const hashed = Array.from(new Uint8Array(hashBuffer))
			.map((byte) => byte.toString(16).padStart(2, "0"))
			.join("");

		const constructed = new LankaEncryptor(key, hashed);

		expect(constructed.getHashedKey()).toBe(derived.getHashedKey());
		expect(await constructed.decrypt(await derived.encrypt("hello"))).toBe("hello");
	});
});

describe("encryption over an adapter the application owns", () => {
	it("reads through the class what the built one wrote", async () => {
		const secret = "a-secret-this-app-owns";
		const adapter = createPlaygroundMemoryAdapter();

		const built = await createLankaCipher(adapter, secret, true, "notes:");
		await built.setItem("token", "12345");

		// Nothing readable reached the adapter: the value is ciphertext and the key
		// is a hash, because a key name in storage tells you what is under it.
		expect([...adapter.written.values()]).not.toContain("12345");
		expect([...adapter.written.keys()].some((key) => key.includes("token"))).toBe(false);

		// The class, over the same adapter and the same key, with an empty cache —
		// so this read decrypts what was actually written rather than remembering.
		const constructed = new LankaCipher(
			adapter,
			await createLankaEncryptor(secret),
			true,
			"notes:",
		);

		expect(await constructed.getItem("token")).toBe("12345");
	});
});
