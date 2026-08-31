import type { ILankaSkillSource } from "./ILankaSkillSource";

/**
 * What a sync would do, decided before anything is written.
 *
 * Three lists rather than a count, because the three demand different things of
 * the person running it: `install` needs nothing, `update` is routine, and
 * `conflict` is a decision only they can make.
 */
export interface ILankaSkillSyncPlan {
	/** Not present yet. Copied. */
	install: readonly ILankaSkillSource[];
	/** Present and written by an earlier sync. Replaced. */
	update: readonly ILankaSkillSource[];
	/**
	 * Present and NOT written by a sync — hand-written, or from somewhere else.
	 *
	 * Left alone. Overwriting a directory this tool did not create destroys work
	 * nobody asked it to touch, and the loss is silent: the file is simply
	 * different the next time it is read.
	 */
	conflict: readonly ILankaSkillSource[];
}
