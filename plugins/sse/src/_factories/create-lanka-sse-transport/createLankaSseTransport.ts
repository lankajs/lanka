import { LankaSseTransport } from "../../lanka-sse-transport/LankaSseTransport";
import type { ILankaSseConfig } from "../../lanka-sse-transport/LankaSseTransport";

/**
 * The functional style of `LankaSseTransport`: the default connection, which an application may build itself and hand to the plugin.
 *
 * One line, and that is the point — the factory IS the class, so a behaviour
 * cannot exist in one style and not the other. Canon: `skills/parity/SKILL.md`.
 */
export const createLankaSseTransport = (config: ILankaSseConfig = {}): LankaSseTransport =>
	new LankaSseTransport(config);
