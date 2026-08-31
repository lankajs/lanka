import type { ILankaInstance } from "lanka";
import type { ILankaPrefetchPlugin } from "../../src/index";

/** A started application that is about to navigate, and may not need to. */
export interface IPlaygroundNavigation {
	lanka: ILankaInstance;
	prefetch: ILankaPrefetchPlugin;
	/** Every route chunk the sweeper actually pulled, in order. */
	readonly pulled: string[];
	/** Puts a real request on the wire; the returned function completes it. */
	beginRealRequest: () => () => void;
	/** Runs whatever the sweeper has queued, and waits for it. */
	sweep: () => Promise<void>;
}
