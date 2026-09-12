/**
 * Everything `expo-secure-store` publishes, which is three calls.
 *
 * No wipe, no list of what it holds. That is not an omission in this
 * declaration — it is the library, and the reason this adapter is the longest of
 * the four. The keychain stores a value against a key and will delete a key it
 * is handed; anything more is the adapter's to arrange.
 *
 * The options parameter every call accepts is deliberately absent. An
 * application needing a keychain service, an access group or a prompt wraps the
 * engine before handing it over — which keeps this package from growing a
 * passthrough for options it cannot test on a device it does not have.
 */
export interface ILankaSecureStoreEngine {
	getItemAsync(key: string): Promise<string | null>;
	setItemAsync(key: string, value: string): Promise<void>;
	deleteItemAsync(key: string): Promise<void>;
}
