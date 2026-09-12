import type { ILankaReactNativeAsyncStorageEngine } from "../../src/index";

/**
 * AsyncStorage in memory, answering a tick late the way the bridge does.
 *
 * The delay is the point rather than decoration: every answer arriving after the
 * current tick is the property that decides which engine an application picks,
 * and a double that resolved immediately would let a scene be written that a
 * device could not run.
 *
 * `rows` is exposed so a scene can see what actually reached the store.
 */
export const createPlaygroundAsyncStorage = (): ILankaReactNativeAsyncStorageEngine & {
	rows: Map<string, string>;
} => {
	const rows = new Map<string, string>();
	const acrossTheBridge = <TValue>(value: TValue): Promise<TValue> =>
		new Promise((resolve) => setTimeout(() => resolve(value), 0));

	return {
		rows,
		getItem: (key) => acrossTheBridge(rows.get(key) ?? null),
		setItem: async (key, value) => {
			await acrossTheBridge(undefined);
			rows.set(key, value);
		},
		removeItem: async (key) => {
			await acrossTheBridge(undefined);
			rows.delete(key);
		},
		clear: async () => {
			await acrossTheBridge(undefined);
			rows.clear();
		},
		// Frozen, as the library's is: a caller that sorts it must be handed a copy.
		getAllKeys: () => acrossTheBridge(Object.freeze([...rows.keys()])),
	};
};
