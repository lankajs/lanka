import { LankaReactNativeAsyncStorageAdapter } from "../../lanka-react-native-async-storage-adapter/LankaReactNativeAsyncStorageAdapter";
import type { ILankaReactNativeAsyncStorageEngine } from "../../_interfaces/ILankaReactNativeAsyncStorageEngine";

/**
 * The same adapter, for an application that writes factories.
 *
 * Both styles reach the one class, so a behaviour cannot arrive at one and not
 * the other.
 *
 * ```ts
 * const adapter = createLankaReactNativeAsyncStorageAdapter(AsyncStorage);
 * ```
 *
 * @param engine The AsyncStorage default export, or anything of its shape
 */
export const createLankaReactNativeAsyncStorageAdapter = (
	engine: ILankaReactNativeAsyncStorageEngine,
): LankaReactNativeAsyncStorageAdapter => new LankaReactNativeAsyncStorageAdapter(engine);
