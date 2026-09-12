import { LankaSecureStoreAdapter } from "../../lanka-secure-store-adapter/LankaSecureStoreAdapter";
import type { ILankaSecureStoreEngine } from "../../_interfaces/ILankaSecureStoreEngine";

/**
 * The same adapter, for an application that writes factories.
 *
 * Both styles reach the one class, so a behaviour cannot arrive at one and not
 * the other.
 *
 * ```ts
 * import * as SecureStore from "expo-secure-store";
 *
 * const adapter = createLankaSecureStoreAdapter(SecureStore);
 * ```
 *
 * @param engine `expo-secure-store`, or anything of its three-call shape
 */
export const createLankaSecureStoreAdapter = (
	engine: ILankaSecureStoreEngine,
): LankaSecureStoreAdapter => new LankaSecureStoreAdapter(engine);
