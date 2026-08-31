import type { ILankaStorageAdapter } from "../../src/index";

/**
 * Somewhere to write that is not the browser.
 *
 * The seam an application replaces when it wants encryption over storage of its
 * own — a file, a database, a socket. Keeping it in memory here is what lets the
 * scene read the BYTES that were written and prove they are not the plaintext.
 */
export const createPlaygroundMemoryAdapter = (): ILankaStorageAdapter & {
	written: Map<string, string>;
} => {
	const written = new Map<string, string>();

	return {
		written,
		setItem: (key, value) => {
			written.set(key, value);
			return Promise.resolve();
		},
		getItem: (key) => Promise.resolve(written.get(key) ?? null),
		removeItem: (key) => {
			written.delete(key);
			return Promise.resolve();
		},
		clear: () => {
			written.clear();
			return Promise.resolve();
		},
	};
};
