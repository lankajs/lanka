/**
 * The part of AsyncStorage's surface this adapter uses, declared rather than
 * imported.
 *
 * `@react-native-async-storage/async-storage` is a native module and cannot run
 * in node, so declaring the shape is what makes the adapter testable off the
 * device — and the declaration is itself a statement of what the library is
 * believed to offer, checked by the compiler at every call site.
 *
 * `getAllKeys` answers a READONLY array, which is the library's own signature
 * and the reason the adapter copies before handing it out: the port promises a
 * `string[]` a caller may sort.
 */
export interface ILankaReactNativeAsyncStorageEngine {
	getItem(key: string): Promise<string | null>;
	setItem(key: string, value: string): Promise<void>;
	removeItem(key: string): Promise<void>;
	/** Empties the application's whole space — the library has only one. */
	clear(): Promise<void>;
	getAllKeys(): Promise<readonly string[]>;
}
