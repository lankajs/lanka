/**
 * @lankajs/storage — storage, encryption and state persistence.
 *
 * A module, not a plugin: core calls nothing here.
 *
 * Two ties to core and no more. `LankaLogger`, for storage transaction
 * diagnostics: a private console writer would mean two log formats in one
 * application. And the PORT — `ILankaStorageAdapter` and its two halves are
 * declared in `lanka/storage` and re-exported here, so the test kit can hold the
 * conformance suite every adapter is measured by.
 *
 * No core CONFIG is needed either way: the secret and any legacy plaintext keys
 * come from the application, so storage works before the framework is
 * bootstrapped.
 *
 * TWO adapters share the port — `LankaWebStorageAdapter` and
 * `LankaCacheStorageAdapter` — and both are run through
 * `lankaStorageAdapterConformance`. The synchronous one implements the same
 * promise-returning methods as the asynchronous one; it has nothing to await,
 * but otherwise the port would split in two.
 *
 * `LankaIndexedDbAdapter` is the third adapter and binds a different port: it
 * holds `Blob`s for `@lankajs/blob-cache`, where a string contract would mean
 * base64 and a third more bytes.
 */

export { LankaStorage } from "./lanka-storage/LankaStorage";
export { lankaStorage } from "./lanka-storage/LankaStorage";
export { LankaCacheStorageAdapter } from "./_adapters/lanka-cache-storage-adapter/LankaCacheStorageAdapter";
export { LankaIndexedDbAdapter } from "./_adapters/lanka-indexed-db-adapter/LankaIndexedDbAdapter";
export { LankaWebStorageAdapter } from "./_adapters/lanka-web-storage-adapter/LankaWebStorageAdapter";
export { installLankaCacheStoragePolyfill } from "./cache-storage-polyfill/installLankaCacheStoragePolyfill";
export { LankaEncryptedStorage } from "./lanka-encrypted-storage/LankaEncryptedStorage";
export { lankaEncryptedStorage } from "./lanka-encrypted-storage/LankaEncryptedStorage";
export {
	lankaEncryptedStateStorage,
	setLankaStorageSecret,
	setLankaLegacyPlaintextKeys,
} from "./lanka-encrypted-state-storage/lankaEncryptedStateStorage";
export { LankaCipher } from "./crypt/lanka-cipher/LankaCipher";
export { createLankaCipher } from "./crypt/_factories/create-lanka-cipher/createLankaCipher";
export { LankaEncryptor } from "./crypt/lanka-encryptor/LankaEncryptor";
export { createLankaEncryptor } from "./crypt/_factories/create-lanka-encryptor/createLankaEncryptor";
export { LankaIdRegistry } from "./id-registry/lanka-id-registry/LankaIdRegistry";
export { createLankaIdRegistry } from "./_factories/create-lanka-id-registry/createLankaIdRegistry";
export {
	stringToBigInt,
	bigIntToString,
} from "./id-registry/_utils/string-big-int-codec/stringBigIntCodec";

export type {
	ILankaIdRegistryOptions,
	ILankaIdRegistryPersist,
	ILankaIdRegistrySnapshot,
} from "./id-registry/lanka-id-registry/LankaIdRegistry";
export type { ILankaStorageHandlers } from "./_interfaces/ILankaStorageHandlers";
export type {
	ILankaStorageAdapter,
	ILankaSyncStorageAdapter,
	ILankaAsyncStorageAdapter,
} from "lanka/storage";
export type { ILankaStorageHandler } from "./_interfaces/ILankaStorageHandler";
export type {
	ILankaBlobRecord,
	ILankaBlobStoreAdapter,
} from "./_adapters/lanka-indexed-db-adapter/LankaIndexedDbAdapter";
