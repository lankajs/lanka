import type { ILankaMmkvEngine } from "../../src/index";

/**
 * An MMKV instance, in memory, in either of the two shapes a device ships.
 *
 * The library is a native module and cannot run here, so the playground stands
 * an object of the declared shape in its place. That is not a weaker test of the
 * ADAPTER — the adapter's whole job is the mapping — and it is the only way to
 * run the same scenes over v3 and v4 in one file, which is the difference this
 * package exists to absorb.
 *
 * `rows` is exposed because a scene about a device session wants to see what
 * actually landed on the device.
 */
export const createPlaygroundMmkv = (
	major: 3 | 4 = 4,
): ILankaMmkvEngine & { rows: Map<string, string> } => {
	const rows = new Map<string, string>();
	const remove = (key: string): void => void rows.delete(key);

	const engine = {
		rows,
		getString: (key: string) => rows.get(key),
		set: (key: string, value: string) => {
			rows.set(key, value);
		},
		clearAll: () => {
			rows.clear();
		},
		getAllKeys: () => [...rows.keys()],
	};

	// The one difference between the majors, and the reason the adapter asks the
	// instance instead of reading a version.
	return major === 3 ? { ...engine, delete: remove } : { ...engine, remove };
};
