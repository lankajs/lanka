import { lankaServerStorage } from "../lanka-server-storage/lankaServerStorage";
import type { ILankaRuntime } from "lanka/internal";

/**
 * The strategy this package installs into core.
 *
 * Package-private, and the reason is worth writing down: published, it would be
 * a name a consumer cannot use for anything. Installing it without this
 * package's storage answers `null` for every call, and filling that storage is
 * `runLankaRequest`. A seam for a host with scoping of its own would have to
 * publish the store as well, and nobody has asked for one.
 *
 * Answers `null` outside a scope on purpose: there, the honest answer is "no
 * instance", and core turns that into a named failure. A fallback to the last
 * instance created would be one user's render reading another user's framework.
 */
export const lankaServerRuntimeResolver = (): ILankaRuntime | null =>
	lankaServerStorage.getStore()?.runtime ?? null;
