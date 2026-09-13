import { describe, it, expect, beforeEach } from "vitest";
import { LankaEncryptedStorage } from "./LankaEncryptedStorage";
import { installLankaCacheStoragePolyfill } from "../cache-storage-polyfill/installLankaCacheStoragePolyfill";

/**
 * The vault with its cipher actually attached.
 *
 * `LankaEncryptedStorage.test.ts` beside this file mocks `createLankaCipher`,
 * and it is right to: what it checks is the WIRING — that `checkInit` refuses a
 * read before `init`, that each tier reaches for its own cipher, that the
 * write-through cache is consulted. A stub is the honest tool for that, and a
 * real cipher would make those assertions slower without making them stronger.
 *
 * What a stub cannot answer is whether the thing stores anything. Its `getItem`
 * resolves `null` by construction, so every read in that file would pass against
 * a vault that wrote to nowhere — and ten of the fifteen methods were not called
 * at all, which is how `setSession` and `setCache` came to have no test that
 * could fail.
 *
 * So: a second file, a real key, a real round trip, and the three tiers asked
 * whether they can tell each other apart. Nothing here mocks anything.
 *
 * A CONSTRUCTED vault rather than the ambient `lankaEncryptedStorage`: a second
 * vault has its own key and its own key space, which is the documented reason
 * the class is exported at all, and a shared singleton would carry one test's
 * cipher into the next.
 */
describe("LankaEncryptedStorage, with a real cipher", () => {
	let vault: LankaEncryptedStorage;

	beforeEach(async () => {
		// jsdom has no `caches`, and installing the polyfill on import would make a
		// bare `import` of this package fail in node. The cache tier needs it.
		installLankaCacheStoragePolyfill();
		localStorage.clear();
		sessionStorage.clear();

		vault = new LankaEncryptedStorage();
		await vault.init("a-real-secret");
	});

	it("gives back what was written to the local tier, and forgets it on remove", async () => {
		await vault.setLocal("k", "value-local");
		expect(await vault.getLocal("k")).toBe("value-local");

		await vault.removeLocal("k");
		expect(await vault.getLocal("k")).toBeNull();
	});

	it("gives back what was written to the session tier, and forgets it on remove", async () => {
		await vault.setSession("k", "value-session");
		expect(await vault.getSession("k")).toBe("value-session");

		await vault.removeSession("k");
		expect(await vault.getSession("k")).toBeNull();
	});

	it("gives back what was written to the cache tier, and forgets it on remove", async () => {
		await vault.setCache("k", "value-cache");
		expect(await vault.getCache("k")).toBe("value-cache");

		await vault.removeCache("k");
		expect(await vault.getCache("k")).toBeNull();
	});

	it("keeps three key spaces apart under one key name", async () => {
		// One `init`, one secret, one prefix — and three ciphers over three
		// engines. If the separation came from the prefix rather than the engine,
		// the last write here would win and two tiers would silently answer with a
		// third tier's value.
		await vault.setLocal("same", "from-local");
		await vault.setSession("same", "from-session");
		await vault.setCache("same", "from-cache");

		expect(await vault.getLocal("same")).toBe("from-local");
		expect(await vault.getSession("same")).toBe("from-session");
		expect(await vault.getCache("same")).toBe("from-cache");
	});

	it("empties only the tier it was asked to empty", async () => {
		// `clearSession` reaching `localStorage` is the expensive version of this
		// mistake: signing out would take the preferences with it.
		await vault.setLocal("keep", "local-value");
		await vault.setSession("drop", "session-value");

		await vault.clearSession();

		expect(await vault.getSession("drop")).toBeNull();
		expect(await vault.getLocal("keep")).toBe("local-value");
	});

	it("empties the local tier without taking the session with it", async () => {
		await vault.setLocal("drop", "local-value");
		await vault.setSession("keep", "session-value");

		await vault.clearLocal();

		expect(await vault.getLocal("drop")).toBeNull();
		expect(await vault.getSession("keep")).toBe("session-value");
	});

	it("does not leave the plaintext in the engine it wrote to", async () => {
		// The one assertion the whole class exists for. Everything above would hold
		// just as well for a vault that encrypted nothing.
		await vault.setLocal("secret-key", "the-plaintext");

		expect(JSON.stringify(Object.entries(localStorage))).not.toContain("the-plaintext");
	});
});
