import type { ILankaStorageAdapter } from "lanka/storage";

/**
 * A fake with the one thing a test wants to see beyond the port.
 *
 * Both optional capabilities are REQUIRED here, and that is the type saying what
 * the double does rather than what the port allows. On `ILankaStorageAdapter`
 * the synchronous half and `keys()` are optional because engines differ; on this
 * one they are always there, and a test calling `getItemSync` should not have to
 * narrow a type it can read the source of.
 */
export interface ILankaFakeStorageAdapter extends Required<ILankaStorageAdapter> {
	/** What the store holds right now, for an assertion about what was written. */
	readonly entries: ReadonlyMap<string, string>;
}

/**
 * A storage engine in a `Map`, keeping every clause of `ILankaStorageAdapter`.
 *
 * Two jobs, and they are the same job. A test of something that persists needs
 * an engine without a platform in it; and the port needs a SECOND
 * implementation, because an abstraction typed by its single implementation is
 * not one. `lankaStorageAdapterConformance` runs against this, which is what
 * makes the suite's own spec possible — a broken adapter is this one with one
 * method replaced.
 *
 * It declares BOTH halves. An adapter with no synchronous half is this one with
 * the four methods stripped, and the suite has a clause about exactly that.
 *
 * It is a double, not a fourth engine: no quota, no eviction, no size limit, no
 * other tab writing underneath it. If it ever grows a behaviour no real engine
 * can match, the port has stopped describing the thing it was drawn from.
 */
export const createLankaFakeStorageAdapter = (): ILankaFakeStorageAdapter => {
	const entries = new Map<string, string>();

	return {
		entries,

		getItemSync: (key) => entries.get(key) ?? null,
		setItemSync: (key, value) => {
			entries.set(key, value);
		},
		removeItemSync: (key) => {
			entries.delete(key);
		},
		clearSync: () => {
			entries.clear();
		},

		// The asynchronous half over the same `Map`, which is clause 9 by
		// construction: a double whose two halves held separate state would pass a
		// clause that every real engine has to earn.
		getItem: (key) => Promise.resolve(entries.get(key) ?? null),
		setItem: (key, value) => {
			entries.set(key, value);
			return Promise.resolve();
		},
		removeItem: (key) => {
			entries.delete(key);
			return Promise.resolve();
		},
		clear: () => {
			entries.clear();
			return Promise.resolve();
		},
		keys: () => Promise.resolve([...entries.keys()]),
	};
};
