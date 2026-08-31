import { getActiveRuntime } from "../../_internal/active-runtime/activeRuntime";
import type { ILankaFlags } from "../_interfaces/ILankaFlags";

/**
 * Flags of the active instance — or empty when there is none.
 *
 * A missing instance is NOT an error here, unlike a missing host. Flags are read
 * earliest of all: `LankaLogger` decides from them whether to write at all, and
 * does so before any `createLanka()`. Empty flags mean "everything off", which
 * is a correct answer; a missing host has no correct answer.
 *
 * This is the AMBIENT read — for modules and plugins that never see an instance.
 * Whoever holds one asks it: `lanka.getFlags()`.
 */
export function getLankaFlags(): ILankaFlags {
	return getActiveRuntime()?.getFlags() ?? {};
}
