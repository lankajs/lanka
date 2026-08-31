import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The zustand `StateStorage` a persisted session rests on.
 *
 * Every behaviour below is one the module goes out of its way to provide, and
 * every one of them could be lost silently.
 */

const SESSION_KEY = "session_info_key";

const mocks = vi.hoisted(() => ({
	isWebCryptoAvailable: vi.fn(() => true),
	init: vi.fn(async () => {}),
	getLocal: vi.fn(
		async (_name: string, _decrypt: boolean): Promise<string | undefined> => undefined,
	),
	setLocal: vi.fn(async (_name: string, _value: string) => {}),
	removeLocal: vi.fn(async (_name: string) => {}),
}));

vi.mock("../crypt/_utils/is-web-crypto-available/isWebCryptoAvailable", () => ({
	isWebCryptoAvailable: mocks.isWebCryptoAvailable,
}));

vi.mock("../lanka-encrypted-storage/LankaEncryptedStorage", () => ({
	// The instance, not the class: the module under test calls the ambient one.
	lankaEncryptedStorage: {
		init: mocks.init,
		getLocal: mocks.getLocal,
		setLocal: mocks.setLocal,
		removeLocal: mocks.removeLocal,
	},
}));

/**
 * The framework is NOT bootstrapped here, and that is an assertion rather than
 * saved lines: everything the storage needs is set by the application through a
 * direct call. Any remaining `getLankaHost()` inside the module would fail every
 * test in this file.
 */
const load = async (legacyKeys?: readonly string[]) => {
	const module = await import("./lankaEncryptedStateStorage");
	// The application sets the secret. Taking it from `import.meta.env` with a
	// shared fallback would give the test one for free while the package fails in
	// node.
	module.setLankaStorageSecret("test-secret");
	if (legacyKeys) module.setLankaLegacyPlaintextKeys(legacyKeys);
	return module.lankaEncryptedStateStorage;
};

beforeEach(() => {
	vi.resetModules();
	vi.clearAllMocks();
	mocks.isWebCryptoAvailable.mockReturnValue(true);
	mocks.init.mockResolvedValue(undefined);
	mocks.getLocal.mockResolvedValue(undefined);
});

describe("LankaEncryptedStateStorage — without Web Crypto", () => {
	beforeEach(() => mocks.isWebCryptoAvailable.mockReturnValue(false));

	it("reads nothing rather than falling back to plaintext", async () => {
		const storage = await load();

		await expect(storage.getItem("state")).resolves.toBeNull();
		expect(mocks.init).not.toHaveBeenCalled();
		expect(mocks.getLocal).not.toHaveBeenCalled();
	});

	it("writes nothing, so PII never lands in localStorage in the clear", async () => {
		const storage = await load();

		await storage.setItem("state", '{"token":"secret"}');
		await storage.removeItem("state");

		// The whole point of the ladder: losing persistence is acceptable, losing
		// encryption is not.
		expect(mocks.setLocal).not.toHaveBeenCalled();
		expect(mocks.removeLocal).not.toHaveBeenCalled();
	});
});

describe("LankaEncryptedStateStorage — the happy path", () => {
	it("returns what was stored", async () => {
		mocks.getLocal.mockResolvedValue('{"user":1}');
		const storage = await load();

		await expect(storage.getItem("state")).resolves.toBe('{"user":1}');
		expect(mocks.getLocal).toHaveBeenCalledWith("state", true);
	});

	it("turns a missing entry into null, which is what zustand hydration expects", async () => {
		mocks.getLocal.mockResolvedValue(undefined);
		const storage = await load();

		await expect(storage.getItem("state")).resolves.toBeNull();
	});

	it("passes writes and deletes straight through", async () => {
		const storage = await load();

		await storage.setItem("state", "value");
		await storage.removeItem("state");

		expect(mocks.setLocal).toHaveBeenCalledWith("state", "value");
		expect(mocks.removeLocal).toHaveBeenCalledWith("state");
	});
});

describe("LankaEncryptedStateStorage — initialisation", () => {
	it("initialises exactly once for a burst of concurrent hydration calls", async () => {
		let resolveInit: () => void = () => {};
		mocks.init.mockReturnValue(
			new Promise<void>((resolve) => {
				resolveInit = resolve;
			}),
		);
		const storage = await load();

		const pending = [storage.getItem("a"), storage.setItem("b", "1"), storage.removeItem("c")];
		resolveInit();
		await Promise.all(pending);

		// The storage flips its own guard only AFTER the async setup resolves, so
		// without the memo three concurrent callers would each start their own key
		// derivation.
		expect(mocks.init).toHaveBeenCalledTimes(1);
	});

	it("does not cache a rejected init — a transient failure must not be permanent", async () => {
		mocks.init.mockRejectedValueOnce(new Error("no secure context"));
		const storage = await load();

		await expect(storage.getItem("state")).resolves.toBeNull();
		mocks.getLocal.mockResolvedValue("recovered");

		// The second call must try again rather than replay a memoised rejection.
		await expect(storage.getItem("state")).resolves.toBe("recovered");
		expect(mocks.init).toHaveBeenCalledTimes(2);
	});

	it("leaves localStorage alone until the app names the legacy keys", async () => {
		// Another app's history is not a property of this storage. A package
		// cleaning a key by default would delete a record from a new consumer whose
		// purpose it knows nothing about.
		const removeItem = vi.spyOn(localStorage, "removeItem");
		const storage = await load();

		await storage.getItem("state");

		expect(removeItem).not.toHaveBeenCalled();
		removeItem.mockRestore();
	});

	it("deletes the named legacy plaintext keys once", async () => {
		// Spied on the INSTANCE, not the prototype: the shared setup file swaps
		// `window.localStorage` for a plain object, so a prototype spy intercepts
		// nothing and the assertion would pass on an empty call list.
		const removeItem = vi.spyOn(localStorage, "removeItem");
		const storage = await load([SESSION_KEY]);

		await storage.getItem("state");
		await storage.getItem("state");

		// The migration rides on the memoised init, so it runs once no matter how
		// many reads hydration makes.
		expect(removeItem).toHaveBeenCalledTimes(1);
		expect(removeItem).toHaveBeenCalledWith(SESSION_KEY);
		removeItem.mockRestore();
	});

	it("survives a localStorage that refuses to be read", async () => {
		const removeItem = vi.spyOn(localStorage, "removeItem").mockImplementation(() => {
			throw new Error("storage denied");
		});
		mocks.getLocal.mockResolvedValue("value");
		const storage = await load([SESSION_KEY]);

		// A browser blocking storage must still get its encrypted state back: the
		// cleanup is a nicety and must not be allowed to fail the read.
		await expect(storage.getItem("state")).resolves.toBe("value");
		removeItem.mockRestore();
	});
});

describe("LankaEncryptedStateStorage — failures are swallowed", () => {
	it("reports an unreadable entry as absent instead of rejecting", async () => {
		// zustand's `persist` turns a rejection here into an unhandled promise
		// rejection during hydration, which reads as a crash on a device whose only
		// problem is corrupt ciphertext.
		mocks.getLocal.mockRejectedValue(new Error("corrupt ciphertext"));
		const storage = await load();

		await expect(storage.getItem("state")).resolves.toBeNull();
	});

	it("keeps state in memory when a write fails", async () => {
		mocks.setLocal.mockRejectedValue(new Error("quota exceeded"));
		const storage = await load();

		await expect(storage.setItem("state", "value")).resolves.toBeUndefined();
	});

	it("treats a failed delete as nothing-to-delete", async () => {
		mocks.removeLocal.mockRejectedValue(new Error("storage denied"));
		const storage = await load();

		await expect(storage.removeItem("state")).resolves.toBeUndefined();
	});
});
