import { LankaUnstorageAdapter } from "../../lanka-unstorage-adapter/LankaUnstorageAdapter";
import type { ILankaUnstorageEngine } from "../../_interfaces/ILankaUnstorageEngine";

/**
 * The same adapter, for an application that writes factories.
 *
 * Both styles reach the one class, so a behaviour cannot arrive at one and not
 * the other.
 *
 * ```ts
 * const adapter = createLankaUnstorageAdapter(createStorage({ driver: redisDriver(...) }));
 * ```
 *
 * @param engine An unstorage instance, over whichever driver the application mounted
 */
export const createLankaUnstorageAdapter = (engine: ILankaUnstorageEngine): LankaUnstorageAdapter =>
	new LankaUnstorageAdapter(engine);
