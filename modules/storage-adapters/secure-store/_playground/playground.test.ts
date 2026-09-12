import { describe, expect, it } from "vitest";
import { lankaStorageAdapterConformance } from "@lankajs/tool-testing/lankaStorageAdapterConformance";
import { createLankaSecureStoreAdapter, LankaSecureStoreAdapter } from "../src/index";
import { createLankaFakeStorageAdapter } from "@lankajs/tool-testing";
import { createPlaygroundKeychain, createPlaygroundVault } from "./app";

/**
 * The package, used the way an application with tokens uses it.
 *
 * Every scene here is a promise the ENGINE cannot keep on its own, which is what
 * makes this package more than a rename of three calls.
 */
describe("a vault on a device that refuses most keys", () => {
	it("takes a key the keychain would have rejected", async () => {
		const keychain = createPlaygroundKeychain();
		const vault = createPlaygroundVault(createLankaSecureStoreAdapter(keychain));

		await vault.keep("access-1", "refresh-1");

		expect(await vault.access(), "read back under the name it was written with").toBe(
			"access-1",
		);
		// What the device actually holds: encoded keys the application never typed.
		expect([...keychain.rows.keys()].some((key) => key.includes("_0020"))).toBe(true);
		expect([...keychain.rows.keys()].every((key) => /^[A-Za-z0-9._-]+$/.test(key))).toBe(true);
	});

	it("answers the keys the application wrote, not the ones the device holds", async () => {
		const vault = createPlaygroundVault(
			createLankaSecureStoreAdapter(createPlaygroundKeychain()),
		);

		await vault.keep("access-1", "refresh-1");

		// Clause 11 from the caller's side. The index is the adapter's business;
		// what the application asked for is what it gets back.
		expect((await vault.held()).sort()).toEqual(["auth.access token", "auth.refresh/token"]);
	});

	it("signs out without being told what it wrote", async () => {
		const keychain = createPlaygroundKeychain();
		const vault = createPlaygroundVault(createLankaSecureStoreAdapter(keychain));

		await vault.keep("access-1", "refresh-1");
		await vault.signOut();

		// Including the index row: the keychain is as it was before the session.
		expect([...keychain.rows], "what is left on the device").toEqual([]);
		expect(await vault.access()).toBeNull();
		expect(await vault.held()).toEqual([]);
	});

	it("keeps one row per key through a rotation", async () => {
		const keychain = createPlaygroundKeychain();
		const vault = createPlaygroundVault(createLankaSecureStoreAdapter(keychain));

		await vault.keep("access-1", "refresh-1");
		await vault.rotate("access-2");
		await vault.rotate("access-3");

		expect(await vault.access()).toBe("access-3");
		expect(await vault.held(), "two keys, however many rotations").toHaveLength(2);
		// Two tokens and the index, and nothing accumulating per write.
		expect(keychain.rows.size).toBe(3);
	});

	it("leaves rows this adapter did not write alone", async () => {
		const keychain = createPlaygroundKeychain();
		// Something else on the device — another library, an earlier version of the
		// application — under a key this adapter has never seen.
		await keychain.setItemAsync("somebody.elses.row", "kept");

		const vault = createPlaygroundVault(createLankaSecureStoreAdapter(keychain));
		await vault.keep("access-1", "refresh-1");
		await vault.signOut();

		expect(await keychain.getItemAsync("somebody.elses.row")).toBe("kept");
	});

	it("refuses a value the platform would truncate", async () => {
		const adapter = createLankaSecureStoreAdapter(createPlaygroundKeychain());

		// The failure being prevented: the platform takes the first two kilobytes
		// and reports success, and the token reads back whole and decrypts to
		// nothing a week later.
		await expect(adapter.setItem("auth.token", "x".repeat(2049))).rejects.toThrow(/bytes/);
		expect(await adapter.getItem("auth.token")).toBeNull();
	});

	it("survives an index a previous version left unreadable", async () => {
		const keychain = createPlaygroundKeychain();
		await keychain.setItemAsync("lanka.secure-store.index", "not json at all");

		const adapter = createLankaSecureStoreAdapter(keychain);
		await adapter.setItem("auth.token", "abc");

		// Treated as empty and rewritten, rather than throwing on every call for
		// the rest of the application's life.
		expect(await adapter.keys()).toEqual(["auth.token"]);
	});

	it("is the same adapter whichever style built it", async () => {
		// Both styles over one keychain — including the INDEX, which is the part a
		// second implementation would have got wrong.
		const keychain = createPlaygroundKeychain();
		const built = new LankaSecureStoreAdapter(keychain);
		const made = createLankaSecureStoreAdapter(keychain);

		await built.setItem("auth.access token", "abc");

		expect(await made.getItem("auth.access token")).toBe("abc");
		expect(await made.keys()).toEqual(["auth.access token"]);
		expect(made).toBeInstanceOf(LankaSecureStoreAdapter);
	});
});

/**
 * The family's shared assertions, with the ceiling declared.
 *
 * `maxValueBytes` turns clause 10 around: instead of asking a large value to
 * survive, it asks for a refusal one byte over and a round trip exactly at the
 * line. This is the only member of the four that answers it that way.
 */
lankaStorageAdapterConformance({
	vendor: "expo-secure-store",
	create: () => createLankaSecureStoreAdapter(createPlaygroundKeychain()),
	maxValueBytes: 2048,
});

describe("an index this adapter did not write", () => {
	/**
	 * Three shapes a keychain row can hold under a name this package chose.
	 *
	 * All three are reachable: an earlier version of the application, another
	 * library that picked the same name, a partial write interrupted by the
	 * process dying. None of them may make the adapter throw on every call
	 * afterwards — a session that cannot sign out is worse than one that forgets
	 * a row.
	 */
	const withIndex = async (raw: string) => {
		const keychain = createPlaygroundKeychain();
		await keychain.setItemAsync("lanka.secure-store.index", raw);

		const adapter = createLankaSecureStoreAdapter(keychain);
		await adapter.setItem("auth.token", "abc");

		return adapter;
	};

	it("treats valid JSON that is not a list as no index at all", async () => {
		const adapter = await withIndex('{"keys":["auth.token"]}');

		expect(await adapter.keys()).toEqual(["auth.token"]);
	});

	it("does not report an entry it could not have written", async () => {
		const keychain = createPlaygroundKeychain();
		await keychain.setItemAsync("lanka.secure-store.index", '[42, null, "auth.legacy"]');
		await keychain.setItemAsync("auth.legacy", "left by something else");

		const adapter = createLankaSecureStoreAdapter(keychain);
		await adapter.setItem("auth.token", "abc");

		// `auth.legacy` carries no row prefix, so this adapter cannot say what
		// spelling it stands for and does not guess one. Listing and wiping are
		// different promises: only the first is about spelling.
		expect(await adapter.keys()).toEqual(["auth.token"]);

		await adapter.clear();

		// And the wipe takes it anyway. An entry this version would not have
		// produced is still likelier to be a row of ours than somebody else's, and
		// being wrong costs a delete that finds nothing.
		expect(await keychain.getItemAsync("auth.legacy"), "named by the index").toBeNull();
		expect([...keychain.rows]).toEqual([]);
	});

	it("still signs out cleanly over a damaged index", async () => {
		const adapter = await withIndex("not json at all");
		await adapter.clear();

		expect(await adapter.keys()).toEqual([]);
		expect(await adapter.getItem("auth.token")).toBeNull();
	});
});

describe("two engines in one application, which is how a device is built", () => {
	/**
	 * The shape every guide in this family recommends, driven end to end.
	 *
	 * Secrets go in the keychain because it is slow and protected; preferences go
	 * in the fast store because they are neither. What makes it worth a scene is
	 * the SIGN-OUT: it must empty one space and leave the other, and the two
	 * spaces are two engines that know nothing about each other.
	 *
	 * Both are reached through the PORT rather than through a storage facade, so
	 * this package needs no dependency to show it — which is also the honest
	 * picture, because the port is what the two engines have in common.
	 *
	 * The fast engine is the kit's double rather than a sibling package: a member
	 * of a family may not depend on another, or installing one would install both.
	 */
	const device = () => {
		const keychain = createPlaygroundKeychain();
		const fast = createLankaFakeStorageAdapter();

		return {
			keychain,
			fast,
			vault: createPlaygroundVault(createLankaSecureStoreAdapter(keychain)),
			preferences: {
				save: (theme: string) => fast.setItem("preferences.theme", theme),
				read: () => fast.getItem("preferences.theme"),
			},
		};
	};

	it("keeps a token out of the fast store and a preference out of the keychain", async () => {
		const app = device();

		await app.vault.keep("access-1", "refresh-1");
		await app.preferences.save("dark");

		// Neither engine has heard of the other's rows, which is the point of
		// splitting them: a keychain dump holds no preferences, and a fast store
		// that leaks holds no secrets.
		expect([...app.fast.entries.keys()]).toEqual(["preferences.theme"]);
		expect(
			[...app.keychain.rows.keys()].some((key) => key.includes("preferences")),
			"a preference in the keychain",
		).toBe(false);
	});

	it("signs out of the keychain and leaves the preferences alone", async () => {
		const app = device();
		await app.vault.keep("access-1", "refresh-1");
		await app.preferences.save("dark");

		await app.vault.signOut();

		expect([...app.keychain.rows], "every secret, index included").toEqual([]);
		expect(await app.preferences.read(), "what was not a secret").toBe("dark");
	});

	it("survives a restart with the preference and without the session", async () => {
		// The next launch of the application, over the engines a device reopened.
		const app = device();
		await app.vault.keep("access-1", "refresh-1");
		await app.preferences.save("dark");
		await app.vault.signOut();

		const relaunched = createPlaygroundVault(createLankaSecureStoreAdapter(app.keychain));

		expect(await relaunched.access()).toBeNull();
		expect(await relaunched.held()).toEqual([]);
		expect(await app.fast.getItem("preferences.theme")).toBe("dark");
	});
});

describe("a key of the application's that looks like the adapter's own", () => {
	/**
	 * The collision that used to empty the index in silence.
	 *
	 * `lanka.secure-store.index` is a legal key and an application is entitled to
	 * use it — a coincidence, a copied constant, a key derived from a package
	 * name. Written straight through, it replaced the index with an ordinary
	 * value, and every secret stored before that moment became invisible to
	 * `clear()`. The sign-out reported success.
	 *
	 * Every caller row now carries a prefix the index does not, so the collision
	 * is not defended against — it cannot be expressed.
	 */
	it("stores it like any other key, and keeps the index", async () => {
		const keychain = createPlaygroundKeychain();
		const adapter = createLankaSecureStoreAdapter(keychain);

		await adapter.setItem("auth.token", "secret");
		await adapter.setItem("lanka.secure-store.index", "an ordinary value");

		expect(await adapter.getItem("auth.token"), "the secret written first").toBe("secret");
		expect(await adapter.getItem("lanka.secure-store.index")).toBe("an ordinary value");
		expect((await adapter.keys()).sort()).toEqual(["auth.token", "lanka.secure-store.index"]);
	});

	it("signs out completely afterwards, which is what the collision broke", async () => {
		const keychain = createPlaygroundKeychain();
		const adapter = createLankaSecureStoreAdapter(keychain);

		await adapter.setItem("auth.token", "secret");
		await adapter.setItem("lanka.secure-store.index", "an ordinary value");
		await adapter.clear();

		expect([...keychain.rows], "the keychain after a sign-out").toEqual([]);
	});

	it("keeps a key that merely starts like a row apart from one that is one", async () => {
		const adapter = createLankaSecureStoreAdapter(createPlaygroundKeychain());

		await adapter.setItem("row.auth.token", "written by the application");
		await adapter.setItem("auth.token", "written by the application too");

		expect(await adapter.getItem("row.auth.token")).toBe("written by the application");
		expect(await adapter.getItem("auth.token")).toBe("written by the application too");
		expect((await adapter.keys()).sort()).toEqual(["auth.token", "row.auth.token"]);
	});
});

describe("values the keychain counts in bytes", () => {
	/**
	 * The ceiling is bytes, and a device does not count characters.
	 *
	 * A value of 1200 emoji is 4800 bytes and would be truncated by the platform
	 * while a length check waved it through. The guard uses `TextEncoder`, and
	 * this is the scene that says so — the difference only appears outside ASCII,
	 * which is exactly where nobody looks.
	 */
	it("refuses a value under the limit in characters and over it in bytes", async () => {
		const adapter = createLankaSecureStoreAdapter(createPlaygroundKeychain());
		const emoji = "🔐".repeat(600);

		expect(emoji.length, "characters, comfortably under the ceiling").toBeLessThan(2048);
		await expect(adapter.setItem("auth.token", emoji)).rejects.toThrow(/2400 bytes|bytes/);
	});

	it("takes a multi-byte value that does fit, and returns it whole", async () => {
		const adapter = createLankaSecureStoreAdapter(createPlaygroundKeychain());
		const note = "naïve café 🔐";

		await adapter.setItem("auth.note", note);

		expect(await adapter.getItem("auth.note")).toBe(note);
	});
});

describe("a keychain that fails in the middle of a wipe", () => {
	it("leaves the index intact so the next sign-out can finish the job", async () => {
		const keychain = createPlaygroundKeychain();
		const adapter = createLankaSecureStoreAdapter(keychain);
		await adapter.setItem("auth.access", "a");
		await adapter.setItem("auth.refresh", "r");

		let refusals = 1;
		const flaky = {
			...keychain,
			deleteItemAsync: (key: string) => {
				if (refusals-- > 0) return Promise.reject(new Error("the keychain is locked"));
				return keychain.deleteItemAsync(key);
			},
		};

		await expect(createLankaSecureStoreAdapter(flaky).clear()).rejects.toThrow(/locked/);

		// The index is the record of what still has to go. Clearing it on the way
		// out would have turned one locked keychain into two permanent secrets.
		const second = createLankaSecureStoreAdapter(keychain);

		expect((await second.keys()).sort()).toEqual(["auth.access", "auth.refresh"]);

		await second.clear();

		expect([...keychain.rows]).toEqual([]);
	});
});
