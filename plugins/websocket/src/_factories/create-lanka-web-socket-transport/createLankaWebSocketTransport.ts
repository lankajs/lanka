import { LankaWebSocketTransport } from "../../lanka-web-socket-transport/LankaWebSocketTransport";
import type { ILankaWebSocketConfig } from "../../lanka-web-socket-transport/LankaWebSocketTransport";

/**
 * The functional style of `LankaWebSocketTransport`: the channel an application
 * builds itself and hands to the plugin, to a gateway, or to `lankaSse`.
 *
 * One line, and that is the point — the factory IS the class, so a behaviour
 * cannot exist in one style and not the other. Canon: `skills/parity/SKILL.md`.
 */
export const createLankaWebSocketTransport = (
	config: ILankaWebSocketConfig = {},
): LankaWebSocketTransport => new LankaWebSocketTransport(config);
