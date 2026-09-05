export interface ILankaAsyncStorageAdapter {
	setItem(key: string, value: string): Promise<void>;
	getItem(key: string): Promise<string | null>;
	removeItem(key: string): Promise<void>;
	clear(): Promise<void>;
	/**
	 * Every key this store holds, when it can say.
	 *
	 * OPTIONAL, because a store need not be able to: a Cache Storage answers
	 * `Request` objects rather than the keys it was given, and a native bridge
	 * may answer nothing at all. A required member here would be a compile error
	 * in every adapter a consumer had already written.
	 *
	 * What it is for: `LankaCipher.clear()` removes what IT wrote instead of
	 * emptying the whole store — a store that cannot enumerate leaves it no
	 * choice but the latter.
	 */
	keys?(): Promise<string[]>;
}
