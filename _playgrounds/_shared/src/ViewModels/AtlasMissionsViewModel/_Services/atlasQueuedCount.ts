import type { IAtlasMissionsState } from "../../../Core/Interfaces/IAtlasMissionsState";

/**
 * How many missions are still waiting, out of the whole board.
 *
 * Written to be passed to `useLankaVM(missionsVM, atlasQueuedCount)`, which is
 * the SELECTED read every binding publishes and, until this existed, no
 * application here used. Five packages each return a different shape from that
 * overload — a plain value, a ref, an accessor, a signal, a `.current` — and a
 * shelf whose second overload is exercised only by its own conformance suite is
 * a shelf whose second overload is proved under no compiler at all.
 *
 * A number, deliberately. The selected read's contract is that the view moves
 * when the SELECTION moves, compared with `Object.is` — and a selector answering
 * a fresh object every time would move on every notification and prove nothing.
 * It is also the case that broke one member: a shape carrying the selection's
 * own keys cannot carry a number, and the binding that tried it narrowed the
 * shared name.
 */
export const atlasQueuedCount = (state: IAtlasMissionsState): number =>
	state.missions.filter((one) => one.status === "queued").length;
