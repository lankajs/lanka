import { LankaIdRegistry } from "../../id-registry/lanka-id-registry/LankaIdRegistry";
import type { ILankaIdRegistryOptions } from "../../id-registry/lanka-id-registry/LankaIdRegistry";

/**
 * The functional style of `LankaIdRegistry`: ids kept as numbers, one registry per set of them.
 *
 * One line, and that is the point — the factory IS the class, so a behaviour
 * cannot exist in one style and not the other. Canon: `skills/parity/SKILL.md`.
 */
export const createLankaIdRegistry = (config: ILankaIdRegistryOptions = {}): LankaIdRegistry =>
	new LankaIdRegistry(config);
