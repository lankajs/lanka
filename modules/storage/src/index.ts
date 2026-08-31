/**
 * @lankajs/storage — storage, encryption and state persistence.
 *
 * A module, not a plugin: core calls nothing here.
 *
 * Exactly ONE tie to core, deliberately: `LankaLogger` in storage transaction
 * diagnostics. A private console writer would mean two log formats in one
 * application. No core config is needed: the secret and any legacy plaintext keys
 * come from the application, so storage works before the framework is
 * bootstrapped.
 *
 * Three adapters share one port. The synchronous one implements the same
 * promise-returning methods as the async ones — it has nothing to await, but
 * otherwise the port would split in two.
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
export type { ILankaStorageAdapter } from "./_interfaces/ILankaStorageAdapter";
export type { ILankaSyncStorageAdapter } from "./_interfaces/ILankaSyncStorageAdapter";
export type { ILankaAsyncStorageAdapter } from "./_interfaces/ILankaAsyncStorageAdapter";
export type { ILankaStorageHandler } from "./_interfaces/ILankaStorageHandler";
export type {
	ILankaBlobRecord,
	ILankaBlobStoreAdapter,
} from "./_adapters/lanka-indexed-db-adapter/LankaIndexedDbAdapter";
