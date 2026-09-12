import { describe, expect, it } from "vitest";
import { lankaStorageAdapterConformance } from "@lankajs/tool-testing/lankaStorageAdapterConformance";
import { createLankaSecureStoreAdapter, LankaSecureStoreAdapter } from "../src/index";
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

	it("is the same adapter whichever style built it", () => {
		expect(createLankaSecureStoreAdapter(createPlaygroundKeychain())).toBeInstanceOf(
			LankaSecureStoreAdapter,
		);
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

	it("drops entries of the list that are not keys", async () => {
		const adapter = await withIndex('[42, null, "auth.legacy"]');

		// The string survives and the rest is ignored, so a `clear()` still walks
		// what it can name instead of failing on the first row it cannot.
		expect((await adapter.keys()).sort()).toEqual(["auth.legacy", "auth.token"]);
	});

	it("still signs out cleanly over a damaged index", async () => {
		const adapter = await withIndex("not json at all");
		await adapter.clear();

		expect(await adapter.keys()).toEqual([]);
		expect(await adapter.getItem("auth.token")).toBeNull();
	});
});
