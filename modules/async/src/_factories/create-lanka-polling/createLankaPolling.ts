import { LankaPolling } from "../../polling/lanka-polling/LankaPolling";

/**
 * The functional style of `LankaPolling`: an interval subscription an application holds one of per screen.
 *
 * One line, and that is the point — the factory IS the class, so a behaviour
 * cannot exist in one style and not the other. Canon: `skills/parity/SKILL.md`.
 */
export const createLankaPolling = (): LankaPolling => new LankaPolling();
