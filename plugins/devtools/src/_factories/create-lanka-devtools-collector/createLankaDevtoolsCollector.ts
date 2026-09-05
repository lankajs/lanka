import { LankaDevtoolsCollector } from "../../lanka-devtools-collector/LankaDevtoolsCollector";
import type { ILankaDevtoolsCollectorConfig } from "../../lanka-devtools-collector/LankaDevtoolsCollector";

/**
 * The functional style of `LankaDevtoolsCollector`: what the inspector keeps, built by the plugin or by an application with its own panel.
 *
 * One line, and that is the point — the factory IS the class, so a behaviour
 * cannot exist in one style and not the other. Canon: `skills/parity/SKILL.md`.
 */
export const createLankaDevtoolsCollector = (
	config: ILankaDevtoolsCollectorConfig = {},
): LankaDevtoolsCollector => new LankaDevtoolsCollector(config);
