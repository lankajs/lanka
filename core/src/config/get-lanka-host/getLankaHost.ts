import { requireActiveRuntime } from "../../_internal/active-runtime/activeRuntime";
import type { ILankaHost } from "../_interfaces/ILankaHost";

/**
 * The host of the active instance.
 *
 * Unlike flags, a missing host IS an error: every field of `ILankaHost` is a
 * product decision with no correct default, so there is nothing to fall back to.
 */
export function getLankaHost(): ILankaHost {
	const host = requireActiveRuntime().config.host;
	if (!host) {
		throw new Error(
			"lanka used before a host was configured. Call createLanka({ host }): the " +
				"framework needs the application's HTTP error copy and its API base URL, " +
				"and neither has a default that would be correct for every application.",
		);
	}
	return host;
}
