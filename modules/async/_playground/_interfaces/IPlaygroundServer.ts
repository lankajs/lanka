import type { IPlaygroundParticipant } from "./IPlaygroundParticipant";

/** The server, stated as data a test can rearrange between assertions. */
export interface IPlaygroundServer {
	participants: IPlaygroundParticipant[];
	/** Requests that actually left, in order. */
	readonly calls: number[];
	/** Answers the next fetch after `ms`, so a slow reply can overtake a fast one. */
	delayMs: number;
}
