import type { IAtlasDeviceEngines } from "../Core/Storage/createAtlasDeviceStorage";

/** A keychain accepts only these characters, and refuses anything else. */
const KEYCHAIN_KEY = /^[A-Za-z0-9._-]+$/;

/** About two kilobytes is what a keychain row holds. */
const KEYCHAIN_LIMIT = 2048;

/**
 * The three engines, in memory, refusing what the real ones refuse.
 *
 * The refusals are the point. A double that accepted any key would make the test
 * "a key with a space in it works" pass for a device on which it does not — and
 * a keychain that truncates rather than refusing is the worst available failure,
 * because half a token reads back as a whole one and decrypts to nothing a week
 * later.
 *
 * None of the three adapters imports its library: every engine is a PEER
 * dependency handed in, which is exactly what makes this file possible on a
 * machine with nothing native on it.
 */
export const createAtlasFakeEngines = (): IAtlasDeviceEngines => {
	const fast = new Map<string, string>();
	const keychain = new Map<string, string>();
	const bridged = new Map<string, string>();

	return {
		mmkv: {
			getString: (key) => fast.get(key),
			set: (key, value) => void fast.set(key, value),
			remove: (key) => void fast.delete(key),
			clearAll: () => fast.clear(),
			getAllKeys: () => [...fast.keys()],
		},

		keychain: {
			getItemAsync: (key) => {
				if (!KEYCHAIN_KEY.test(key)) throw new Error(`Invalid key provided: ${key}`);

				return Promise.resolve(keychain.get(key) ?? null);
			},
			setItemAsync: (key, value) => {
				if (!KEYCHAIN_KEY.test(key)) throw new Error(`Invalid key provided: ${key}`);
				if (value.length > KEYCHAIN_LIMIT) throw new Error("value too large");
				keychain.set(key, value);

				return Promise.resolve();
			},
			deleteItemAsync: (key) => {
				keychain.delete(key);

				return Promise.resolve();
			},
		},

		asyncStorage: {
			getItem: (key) => Promise.resolve(bridged.get(key) ?? null),
			setItem: (key, value) => {
				bridged.set(key, value);

				return Promise.resolve();
			},
			removeItem: (key) => {
				bridged.delete(key);

				return Promise.resolve();
			},
			clear: () => {
				bridged.clear();

				return Promise.resolve();
			},
			// The real one answers a READONLY array, and the adapter copies it on the
			// way out. A double answering a mutable one would hide that.
			getAllKeys: () => Promise.resolve(Object.freeze([...bridged.keys()])),
		},
	};
};
