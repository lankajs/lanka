import { beforeEach, describe, expect, it } from "vitest";
import { createLankaIdRegistry, LankaIdRegistry } from "../src/index";
import { lankaStorage, LankaStorage } from "../src/index";
import { createLankaCipher, createLankaEncryptor, LankaCipher, LankaEncryptor } from "../src/index";
import {
	createPlaygroundMemoryAdapter,
	createPlaygroundTenantStorage,
	createPlaygroundReadMarks,
	createPlaygroundSecretNotes,
	createPlaygroundSession,
	startPlaygroundStorage,
} from "./app";
import { createLankaFakeStorageAdapter } from "@lankajs/tool-testing";
import {
	LANKA_STORAGE_ADAPTER_SCENES,
	LANKA_STORAGE_LITERALS,
	lankaStorageAdapterConformance,
} from "@lankajs/tool-testing/lankaStorageAdapterConformance";

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

/**
 * The seam an application replaces, held to the same list as the framework's own.
 *
 * `createPlaygroundMemoryAdapter` is what a consumer writes when the engine is
 * theirs — a file, a database, a socket. It is not a member of any family and
 * never will be, and that is the point: the conformance suite is published so
 * that an adapter this repository has never heard of is measured by exactly the
 * list the framework holds its own adapters to.
 */
lankaStorageAdapterConformance({
	vendor: "the playground's own adapter",
	create: createPlaygroundMemoryAdapter,
});

describe("the port's list, and the facade above it", () => {
	it("holds every clause of the port to account", () => {
		// The list is DATA so that the suite's own spec can point it at a broken
		// adapter. The cost of data is that a clause can be dropped from it in
		// silence, and the package would go on passing a suite with a hole in it.
		const clauses = [...new Set(LANKA_STORAGE_ADAPTER_SCENES.map((scene) => scene.clause))];

		expect(clauses.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
	});

	it("returns through the facade exactly what the adapter kept", async () => {
		// Clause 1 is about the ADAPTER, and `LankaStorage` sits above it with a
		// read-through memory cache — the one place where an empty string and a
		// missing key could become the same answer on the way out.
		const storage = new LankaStorage({ local: createLankaFakeStorageAdapter() });

		for (const [index, value] of LANKA_STORAGE_LITERALS.entries()) {
			const key = `playground.literal.${String(index)}`;
			await storage.setLocal(key, value);

			expect(await storage.getLocal(key), `the value ${JSON.stringify(value)}`).toBe(value);
		}

		expect(await storage.getLocal("playground.literal.never-written")).toBeNull();
	});
});

describe("one facade, two engines, and no way to tell from above", () => {
	/**
	 * The script an application runs, written once and played twice.
	 *
	 * It is the ordinary life of a stored value and not a list of edge cases: a
	 * value written, read, emptied, read again, removed, and the space wiped at
	 * sign-out. What makes it worth playing twice is that every one of those steps
	 * is somewhere an engine could differ — and the promise of the port is that
	 * none of them does.
	 */
	const play = async (storage: LankaStorage) => {
		await storage.setLocal("playground.theme", "dark");
		const written = await storage.getLocal("playground.theme");

		await storage.setLocal("playground.theme", "");
		const emptied = await storage.getLocal("playground.theme");

		await storage.removeLocal("playground.theme");
		const removed = await storage.getLocal("playground.theme");

		await storage.setLocal("playground.left-behind", "a");
		await storage.clearLocal();
		const afterSignOut = await storage.getLocal("playground.left-behind");

		return { written, emptied, removed, afterSignOut };
	};

	it("answers the same over an engine of its own and over the kit's", async () => {
		// The two engines are genuinely unalike: the tenant storage prefixes every
		// key with its tenant and keeps one map for all three lifetimes, the fake
		// keeps a flat map per space. An application that could tell them apart
		// would be an application the shelf cannot serve.
		const ownEngine = await play(createPlaygroundTenantStorage("acme"));
		const kitEngine = await play(new LankaStorage({ local: createLankaFakeStorageAdapter() }));

		expect(ownEngine).toEqual(kitEngine);
		expect(ownEngine).toEqual({
			written: "dark",
			// The one every guarded write gets wrong: a cleared field is an empty
			// value, not a missing key. `removed` and `afterSignOut` are what a
			// missing key looks like.
			emptied: "",
			removed: null,
			afterSignOut: null,
		});
	});

	it("keeps one tenant's keys out of another's, whichever engine is underneath", async () => {
		const acme = createPlaygroundTenantStorage("acme");
		const other = createPlaygroundTenantStorage("globex");

		await acme.setLocal("playground.theme", "dark");

		expect(await other.getLocal("playground.theme")).toBeNull();
	});
});

describe("mixed modes: two halves, three lifetimes, and a cipher over a swapped engine", () => {
	/**
	 * The combinations an application actually lands in, and none of them is what
	 * a unit test of a single adapter can reach.
	 *
	 * A screen reads synchronously on its first render and writes with an await a
	 * moment later; a sign-out empties one lifetime and must not empty another;
	 * another tab writes underneath a storage that is remembering what it read.
	 * Each of those crosses two units, which is why they are scenes.
	 */
	it("carries a value between the two halves, whichever one wrote it", async () => {
		const storage = new LankaStorage({ local: createLankaFakeStorageAdapter() });

		// The first render writes without awaiting; the load that follows awaits.
		storage.setLocalSync("playground.theme", "dark");

		expect(await storage.getLocal("playground.theme"), "written sync, read awaited").toBe(
			"dark",
		);

		await storage.setLocal("playground.locale", "uk");

		expect(storage.getLocalSync("playground.locale"), "written awaited, read sync").toBe("uk");
	});

	it("refuses the synchronous half over an engine that has none, instead of pretending", () => {
		// Clause 8 of the port, seen from above: the synchronous half is a
		// capability, and an engine without it makes the application choose another
		// rather than quietly write somewhere the next read cannot see.
		const storage = new LankaStorage({ local: createPlaygroundMemoryAdapter() });

		expect(() => storage.setLocalSync("playground.theme", "dark")).toThrow(/not available/);
		expect(() => storage.getLocalSync("playground.theme")).toThrow(/not available/);
	});

	it("re-reads when somebody may have written underneath it", async () => {
		// A storage remembers what it read, which is what makes a second read free.
		// Another tab, a service worker or a native module writing to the same
		// engine is the case where that memory is wrong — and `isCareful` is how a
		// caller says so.
		const engine = createLankaFakeStorageAdapter();
		const storage = new LankaStorage({ local: engine });

		await storage.setLocal("playground.theme", "dark");
		await engine.setItem("playground.theme", "light");

		expect(await storage.getLocal("playground.theme"), "from memory").toBe("dark");
		expect(await storage.getLocal("playground.theme", true), "carefully").toBe("light");
	});

	it("encrypts through whichever engine it was handed", async () => {
		const engine = createLankaFakeStorageAdapter();
		const cipher = await createLankaCipher(engine, "a-secret-the-app-owns", true, "vault");

		await cipher.setItem("note", "meet at noon");

		const written = [...engine.entries];

		expect(written, "something reached the engine").not.toEqual([]);
		expect(
			written.some(([, value]) => value.includes("meet at noon")),
			"the plaintext is not in the engine",
		).toBe(false);
		expect(
			written.some(([key]) => key.includes("note")),
			"nor is the key it was written under",
		).toBe(false);
		expect(await cipher.getItem("note"), "and it still reads back").toBe("meet at noon");
	});

	it("takes only what it wrote when the session ends, over an engine it shares", async () => {
		// The reason `keys()` is on the port at all: the cipher removes ITS rows and
		// leaves the application's own, which is only possible over an engine that
		// can say what it holds.
		const engine = createLankaFakeStorageAdapter();
		const cipher = await createLankaCipher(engine, "a-secret-the-app-owns", true, "vault");

		await engine.setItem("playground.not-the-ciphers", "kept");
		await cipher.setItem("note", "meet at noon");
		await cipher.clear();

		expect(await engine.getItem("playground.not-the-ciphers")).toBe("kept");
		expect(await cipher.getItem("note")).toBeNull();
	});

	it("reaches another lifetime's rows when one engine stands behind all three", async () => {
		// The mistake this scene exists for: `new LankaStorage({ local: h, session: h,
		// cache: h })` is one space wearing three names. The framework's own three
		// lifetimes are three ENGINES — localStorage, sessionStorage, Cache Storage —
		// and everything below follows from a fixture that made them one.
		const tenant = createPlaygroundTenantStorage("acme");

		await tenant.setLocal("playground.theme", "dark");
		await tenant.setSession("playground.draft", "half a sentence");

		// "Forget what this tab was doing" — which reaches the other two, because
		// the engine underneath is the same object.
		await tenant.clearLocal();

		expect(await tenant.getLocal("playground.theme")).toBeNull();

		// And here is the half that surprises: the session answers anyway. Each
		// lifetime keeps its OWN memory of what it read, and clearing one clears one
		// memory. So the row is gone from the engine and still in hand — the exact
		// shape of a draft that survives a sign-out in a screenshot and not on a
		// reload.
		expect(await tenant.getSession("playground.draft"), "from its own memory").toBe(
			"half a sentence",
		);
		expect(await tenant.getSession("playground.draft", true), "asked carefully").toBeNull();
	});
});
