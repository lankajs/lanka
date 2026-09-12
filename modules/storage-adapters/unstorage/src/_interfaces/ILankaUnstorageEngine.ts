/**
 * The part of unstorage's surface this adapter uses.
 *
 * The RAW pair, deliberately: unstorage's `getItem` deserialises, so a stored
 * `"null"` comes back as `null` and a stored `"{}"` as an object. Clause 1 of the
 * port says a value returns byte for byte, which is what `getItemRaw` and
 * `setItemRaw` do.
 *
 * Declared here rather than imported, like every other member's engine — but for
 * a different reason. unstorage runs in node, so this package's playground drives
 * the REAL library, and this type is what that run holds to account: if
 * unstorage's shape ever stopped matching, the playground would not compile.
 */
export interface ILankaUnstorageEngine {
	getItemRaw(key: string): Promise<unknown>;
	setItemRaw(key: string, value: unknown): Promise<void>;
	removeItem(key: string): Promise<void>;
	clear(): Promise<void>;
	getKeys(): Promise<string[]>;
}
