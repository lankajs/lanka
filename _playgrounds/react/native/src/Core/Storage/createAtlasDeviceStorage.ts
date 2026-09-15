import { LankaStorage } from "@lankajs/storage";
import { createLankaMmkvAdapter } from "@lankajs/mmkv";
import { createLankaReactNativeAsyncStorageAdapter } from "@lankajs/react-native-async-storage";
import { createLankaSecureStoreAdapter } from "@lankajs/secure-store";
import type { ILankaMmkvEngine } from "@lankajs/mmkv";
import type { ILankaReactNativeAsyncStorageEngine } from "@lankajs/react-native-async-storage";
import type { ILankaSecureStoreEngine } from "@lankajs/secure-store";

/** The three native engines a device application actually has. */
export interface IAtlasDeviceEngines {
	/** The fast one. It is the only engine that can answer during a render. */
	mmkv: ILankaMmkvEngine;
	/** The device's own lock. Slow, small, and the only right place for a token. */
	keychain: ILankaSecureStoreEngine;
	/** The one most applications already have. */
	asyncStorage: ILankaReactNativeAsyncStorageEngine;
}

/**
 * One store, three engines, and a reason for each.
 *
 * This is the ordinary shape on a device rather than a demonstration of three
 * packages: preferences go in the fast store, the token goes behind the device's
 * lock, and the engine the application already had keeps what is neither.
 *
 * - **`local` is MMKV**, because it is the only one with both halves of the
 *   port. A device decides which screen to mount before it renders anything, and
 *   an engine that must be awaited has not answered by then.
 * - **`session` is the keychain**, because a token belongs behind the device's
 *   own lock. A keychain read is orders of magnitude slower than MMKV, so only
 *   what must be there goes there.
 * - **`cache` is AsyncStorage**, the engine an application most likely already
 *   has, and the one with nothing to prove.
 *
 * What is NOT here: `LankaEncryptedStorage` over any of them. MMKV encrypts with
 * a key given to the instance and a keychain is ciphertext at rest already — a
 * second cipher over either costs a key derivation per read and protects against
 * nothing the first one missed.
 */
export const createAtlasDeviceStorage = (engines: IAtlasDeviceEngines): LankaStorage =>
	new LankaStorage({
		local: createLankaMmkvAdapter(engines.mmkv),
		session: createLankaSecureStoreAdapter(engines.keychain),
		cache: createLankaReactNativeAsyncStorageAdapter(engines.asyncStorage),
	});
