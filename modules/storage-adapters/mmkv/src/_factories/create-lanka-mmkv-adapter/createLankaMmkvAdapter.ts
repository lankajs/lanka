import { LankaMmkvAdapter } from "../../lanka-mmkv-adapter/LankaMmkvAdapter";
import type { ILankaMmkvEngine } from "../../_interfaces/ILankaMmkvEngine";

/**
 * The same adapter, for an application that writes factories.
 *
 * Both styles reach the one class, so a behaviour cannot arrive at one and not
 * the other. Which to use is the project's habit, not a capability.
 *
 * ```ts
 * const adapter = createLankaMmkvAdapter(new MMKV({ id: "session" }));
 * ```
 *
 * @param engine An MMKV instance — v3 or v4, this asks which it has
 */
export const createLankaMmkvAdapter = (engine: ILankaMmkvEngine): LankaMmkvAdapter =>
	new LankaMmkvAdapter(engine);
