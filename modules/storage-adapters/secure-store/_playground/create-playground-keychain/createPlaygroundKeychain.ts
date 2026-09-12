import type { ILankaSecureStoreEngine } from "../../src/index";

/** Keys `expo-secure-store` accepts; anything else it refuses. */
const KEYCHAIN_SAFE = /^[A-Za-z0-9._-]+$/;

/**
 * A keychain in memory, refusing what a keychain refuses.
 *
 * The double's value is entirely in the NOs. A permissive stand-in would let
 * every scene pass and tell an application nothing about the device it is going
 * to run on, so this one rejects a key outside the allowed characters exactly as
 * the library does — which is what holds the adapter's encoding to account.
 *
 * The value ceiling is deliberately NOT enforced here: the platform truncates
 * rather than refusing, which is the failure the adapter exists to prevent, and
 * a double that threw instead would make the adapter's guard untestable.
 *
 * `rows` is exposed so a scene can see what the keychain actually holds — the
 * encoded keys, the index, and the fact that a caller never sees either.
 */
export const createPlaygroundKeychain = (): ILankaSecureStoreEngine & {
	rows: Map<string, string>;
} => {
	const rows = new Map<string, string>();
	const refuseUnsafe = (key: string): void => {
		if (!KEYCHAIN_SAFE.test(key)) {
			throw new Error(`Invalid key provided: ${key}. Keys must be alphanumeric with . - _`);
		}
	};

	return {
		rows,
		getItemAsync: (key) => {
			refuseUnsafe(key);
			return Promise.resolve(rows.get(key) ?? null);
		},
		setItemAsync: (key, value) => {
			refuseUnsafe(key);
			rows.set(key, value);
			return Promise.resolve();
		},
		deleteItemAsync: (key) => {
			refuseUnsafe(key);
			rows.delete(key);
			return Promise.resolve();
		},
	};
};
