import { LankaOptimisticActions } from "../../lanka-optimistic-actions/LankaOptimisticActions";

/**
 * The functional style of `LankaOptimisticActions`: the pair of concurrency strategies, held for as long as the screen is.
 *
 * One line, and that is the point — the factory IS the class, so a behaviour
 * cannot exist in one style and not the other. Canon: `skills/parity/SKILL.md`.
 */
export const createLankaOptimisticActions = (): LankaOptimisticActions =>
	new LankaOptimisticActions();
