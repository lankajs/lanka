import type { ILankaReleaseMemory } from "../../_interfaces/ILankaReleaseMemory";

const KEY = "lanka.release.version";

/**
 * The default memory: `localStorage`, and silence when there is none.
 *
 * A browser with storage disabled makes every visit look like the first one —
 * the caches are dropped once per visit, which is wasteful and correct. Throwing
 * instead would take down the application over a preference.
 */
export const createLocalStorageMemory = (): ILankaReleaseMemory => ({
	read: () => {
		try {
			return globalThis.localStorage?.getItem(KEY) ?? null;
		} catch {
			return null;
		}
	},

	write: (version: string) => {
		try {
			globalThis.localStorage?.setItem(KEY, version);
		} catch {
			// Nothing to do and nothing to say: the next visit re-drops the caches.
		}
	},
});
