import { beforeEach, describe, expect, it } from "vitest";
import { LankaCipher } from "./LankaCipher";
import { createLankaCipher } from "../_factories/create-lanka-cipher/createLankaCipher";
import { createLankaEncryptor } from "../_factories/create-lanka-encryptor/createLankaEncryptor";
import type { ILankaStorageAdapter } from "lanka/storage";

/**
 * Where a cipher writes, what it can find again, and what it may delete.
 *
 * `LankaCipher.test.ts` beside this one is about the round trip — a value goes in
 * and comes back. This file is about the KEY: the name is hidden from whoever
 * reads the store, an entry written by the previous scheme is not lost, and
 * clearing removes what this cipher wrote rather than everything the page has.
 */

/** A store that can be looked into, the way a person looks at localStorage. */
class InspectableAdapter implements ILankaStorageAdapter {
	public readonly store = new Map<string, string>();

	async setItem(key: string, value: string): Promise<void> {
		this.store.set(key, value);
	}
	async getItem(key: string): Promise<string | null> {
		return this.store.get(key) ?? null;
	}
	async removeItem(key: string): Promise<void> {
		this.store.delete(key);
	}
	async clear(): Promise<void> {
		this.store.clear();
	}
	async keys(): Promise<string[]> {
		return [...this.store.keys()];
	}
}

/** The same store, unable to say what it holds — a Cache Storage, a native bridge. */
class OpaqueAdapter implements ILankaStorageAdapter {
	public readonly store = new Map<string, string>();

	async setItem(key: string, value: string): Promise<void> {
		this.store.set(key, value);
	}
	async getItem(key: string): Promise<string | null> {
		return this.store.get(key) ?? null;
	}
	async removeItem(key: string): Promise<void> {
		this.store.delete(key);
	}
	async clear(): Promise<void> {
		this.store.clear();
	}
}

const sha256Hex = async (text: string): Promise<string> => {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
	return Array.from(new Uint8Array(digest))
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
};

/** An entry exactly as the PREVIOUS scheme wrote it: `prefix + sha256(name)`. */
const seedLegacyEntry = async (
	adapter: ILankaStorageAdapter,
	secret: string,
	prefix: string,
	name: string,
	value: string,
): Promise<string> => {
	const encryptor = await createLankaEncryptor(secret);
	const legacyKey = prefix + (await sha256Hex(name));
	await adapter.setItem(legacyKey, await encryptor.encrypt(value));
	return legacyKey;
};

describe("LankaCipher — the name a reader of the store sees", () => {
	let adapter: InspectableAdapter;
	let cipher: LankaCipher;

	beforeEach(async () => {
		adapter = new InspectableAdapter();
		cipher = await createLankaCipher(adapter, "my-secret");
	});

	// The stored key used to be the plain SHA-256 of the name, which is a lookup
	// in a table anybody can build for the handful of names an application uses.
	it("writes under a key nobody can compute without the secret", async () => {
		await cipher.setItem("token", "12345");

		expect([...adapter.store.keys()]).not.toContain(await sha256Hex("token"));
	});

	it("writes the name nowhere in the clear", async () => {
		await cipher.setItem("token", "12345");

		expect([...adapter.store.keys()].some((key) => key.includes("token"))).toBe(false);
	});
});

describe("LankaCipher — an entry the previous scheme wrote", () => {
	// The key derivation changed, so an application upgrading would otherwise read
	// null for everything it had stored: a signed-in user signed out by an
	// upgrade, a persisted screen back to its empty state.
	it("is still readable", async () => {
		const adapter = new InspectableAdapter();
		await seedLegacyEntry(adapter, "my-secret", "", "token", "12345");
		const cipher = await createLankaCipher(adapter, "my-secret");

		expect(await cipher.getItem("token")).toBe("12345");
	});

	it("is moved to the new key and the old one is dropped", async () => {
		const adapter = new InspectableAdapter();
		const legacyKey = await seedLegacyEntry(adapter, "my-secret", "", "token", "12345");
		const cipher = await createLankaCipher(adapter, "my-secret");

		await cipher.getItem("token");

		expect(adapter.store.has(legacyKey)).toBe(false);
		expect(adapter.store.size).toBe(1);
	});

	it("is carried across a prefix as well", async () => {
		const adapter = new InspectableAdapter();
		await seedLegacyEntry(adapter, "my-secret", "app:", "token", "12345");
		const cipher = await createLankaCipher(adapter, "my-secret", true, "app:");

		expect(await cipher.getItem("token")).toBe("12345");
	});

	it("is removed by `removeItem`, not left behind under its old key", async () => {
		const adapter = new InspectableAdapter();
		const legacyKey = await seedLegacyEntry(adapter, "my-secret", "", "token", "12345");
		const cipher = await createLankaCipher(adapter, "my-secret");

		await cipher.removeItem("token");

		expect(adapter.store.has(legacyKey)).toBe(false);
	});

	it("costs one lookup per name, not one per read", async () => {
		const adapter = new InspectableAdapter();
		const cipher = await createLankaCipher(adapter, "my-secret");
		let reads = 0;
		const counted = adapter.getItem.bind(adapter);
		adapter.getItem = async (key: string) => {
			reads += 1;
			return counted(key);
		};

		await cipher.getItem("absent");
		const afterFirst = reads;
		await cipher.getItem("absent");

		// The first miss looks for a legacy copy; the second knows there is none.
		expect(afterFirst).toBe(2);
		expect(reads).toBe(3);
	});
});

describe("LankaCipher — clearing", () => {
	// `clear()` is what an application calls on sign-out. It called the adapter's
	// own `clear()`, which for `localStorage` empties EVERYTHING the page has: the
	// theme, the language, the consent record, another library's data, and the
	// release guard's version — so the next visit dropped every cache as well.
	it("leaves alone what this cipher did not write", async () => {
		const adapter = new InspectableAdapter();
		await adapter.setItem("theme", "dark");
		const cipher = await createLankaCipher(adapter, "my-secret");
		await cipher.setItem("token", "12345");

		await cipher.clear();

		expect(await adapter.getItem("theme")).toBe("dark");
	});

	it("removes everything this cipher did write", async () => {
		const adapter = new InspectableAdapter();
		const cipher = await createLankaCipher(adapter, "my-secret");
		await cipher.setItem("token", "12345");
		await cipher.setItem("user", "Alice");

		await cipher.clear();

		expect(await cipher.getItem("token")).toBeNull();
		expect(await cipher.getItem("user")).toBeNull();
	});

	it("removes an entry the previous scheme wrote, read or not", async () => {
		// Otherwise a sign-out would leave one user's data on a shared device for
		// every key the session happened not to touch.
		const adapter = new InspectableAdapter();
		const legacyKey = await seedLegacyEntry(adapter, "my-secret", "", "token", "12345");
		const cipher = await createLankaCipher(adapter, "my-secret");

		await cipher.clear();

		expect(adapter.store.has(legacyKey)).toBe(false);
	});

	it("clears only its own prefix when it was given one", async () => {
		const adapter = new InspectableAdapter();
		const mine = await createLankaCipher(adapter, "my-secret", true, "mine:");
		const theirs = await createLankaCipher(adapter, "my-secret", true, "theirs:");
		await mine.setItem("token", "ours");
		await theirs.setItem("token", "not ours");

		await mine.clear();

		// Read through the STORE rather than through `theirs`: that cipher answers
		// from its own value cache, which would report the entry alive whether or
		// not anything was left behind.
		const left = [...adapter.store.keys()];
		expect(left.filter((key) => key.startsWith("theirs:"))).toHaveLength(1);
		expect(left.filter((key) => key.startsWith("mine:"))).toHaveLength(0);
	});

	it("empties a store that cannot say what it holds", async () => {
		// A Cache Storage adapter has no key list and its `clear()` deletes its own
		// named cache — already scoped. Falling back to it is the honest answer
		// rather than guessing which entries were ours.
		const adapter = new OpaqueAdapter();
		const cipher = await createLankaCipher(adapter, "my-secret");
		await cipher.setItem("token", "12345");

		await cipher.clear();

		expect(adapter.store.size).toBe(0);
	});

	it("clears with encryption disabled too", async () => {
		const adapter = new InspectableAdapter();
		await adapter.setItem("theme", "dark");
		const cipher = await createLankaCipher(adapter, "my-secret", false);
		await cipher.setItem("token", "12345");

		await cipher.clear();

		expect(await cipher.getItem("token")).toBeNull();
		expect(await adapter.getItem("theme")).toBe("dark");
	});
});

describe("LankaCipher — with encryption disabled", () => {
	it("still finds what the previous scheme wrote in the clear", async () => {
		const adapter = new InspectableAdapter();
		await adapter.setItem("token", "12345");
		const cipher = await createLankaCipher(adapter, "my-secret", false);

		expect(await cipher.getItem("token")).toBe("12345");
	});
});
