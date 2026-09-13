import type { IAtlasMission } from "../../../Core/Interfaces/IAtlasMission";

/**
 * Puts a changed mission back among its neighbours.
 *
 * Answers the SAME array when the mission is not in it. That is not an
 * optimisation: the list is a prop for every row below it, and a new array for a
 * change that touched nothing re-renders a screen that did not move. A scenario
 * handler is exactly where that happens, because it fires for facts about rows
 * this screen has never loaded.
 */
export const replaceAtlasMission = (
	missions: readonly IAtlasMission[],
	changed: IAtlasMission,
): readonly IAtlasMission[] => {
	const at = missions.findIndex((mission) => mission.id === changed.id);
	if (at === -1) return missions;

	const next = [...missions];
	next[at] = changed;

	return next;
};
