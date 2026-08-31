import type { IPlaygroundParticipant } from "../_interfaces/IPlaygroundParticipant";
import type { IPlaygroundServer } from "../_interfaces/IPlaygroundServer";

/** The only stub in this playground. */
export const createPlaygroundServer = (
	participants: IPlaygroundParticipant[] = [],
): IPlaygroundServer => ({
	participants,
	calls: [],
	delayMs: 0,
});
