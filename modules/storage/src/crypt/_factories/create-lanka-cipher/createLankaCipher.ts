import { LankaCipher } from "../../lanka-cipher/LankaCipher";
import { createLankaEncryptor } from "../create-lanka-encryptor/createLankaEncryptor";
import type { ILankaStorageAdapter } from "lanka/storage";

/**
 * Derives the key and wraps an adapter in encryption.
 *
 * A free function rather than a `static create`, for the reason `skills/forms`
 * §1a gives and `createLankaEncryptor` follows: key derivation is async, a
 * constructor cannot await, and a static factory beside a private constructor
 * reads as the anti-pattern §1 bans without being one.
 *
 * ```ts
 * const secure = await createLankaCipher(adapter, "secret");
 * await secure.setItem("token", "12345");
 * ```
 *
 * @param adapter Where to write
 * @param secretKey The secret the key is derived from
 * @param isEncryptionEnabled When off, values are written as-is
 * @param keyPrefix Prefix for storage keys
 */
export const createLankaCipher = async (
	adapter: ILankaStorageAdapter,
	secretKey: string,
	isEncryptionEnabled = true,
	keyPrefix = "",
): Promise<LankaCipher> =>
	new LankaCipher(adapter, await createLankaEncryptor(secretKey), isEncryptionEnabled, keyPrefix);
