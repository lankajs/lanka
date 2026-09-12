import type { ILankaStorageAdapter } from "lanka/storage";

/**
 * The engine this application already had, behind the framework's port.
 *
 * An adapter lanka has never heard of, written by the application over an object
 * it was passing around anyway. It declares NEITHER optional capability — no
 * synchronous half, no `keys()` — which is the ordinary shape of a first
 * adapter, and the shape the conformance suite has to serve if it is published
 * for outsiders at all.
 *
 * The bag is handed in rather than created here for the same reason every engine
 * is: the application already owns it, and a test wants to look inside.
 */
export const createPlaygroundBagAdapter = (
	bag: Record<string, string> = {},
): ILankaStorageAdapter => ({
	setItem: (key, value) => {
		bag[key] = value;
		return Promise.resolve();
	},

	getItem: (key) => Promise.resolve(Object.hasOwn(bag, key) ? bag[key] : null),

	removeItem: (key) => {
		// `delete` rather than assigning `undefined`: clause 2 says a missing key
		// answers `null`, and a key holding `undefined` is present to `hasOwn`.
		delete bag[key];
		return Promise.resolve();
	},

	clear: () => {
		for (const key of Object.keys(bag)) delete bag[key];
		return Promise.resolve();
	},
});
