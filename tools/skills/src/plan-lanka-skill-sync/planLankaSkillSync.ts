import { lankaSkillMarker } from "../lanka-skill-marker/lankaSkillMarker";
import type { ILankaSkillHost } from "../_interfaces/ILankaSkillHost";
import type { ILankaSkillSource } from "../_interfaces/ILankaSkillSource";
import type { ILankaSkillSyncPlan } from "../_interfaces/ILankaSkillSyncPlan";

export interface IPlanLankaSkillSyncOptions {
	sources: readonly ILankaSkillSource[];
	/** Where skills are installed, absolute. */
	target: string;
	host: ILankaSkillHost;
	/** Replace a directory this tool did not write. Off by default. */
	force?: boolean;
}

/** What is already at a skill's destination. */
const stateOf = (
	options: IPlanLankaSkillSyncOptions,
	source: ILankaSkillSource,
): "absent" | "managed" | "foreign" => {
	const destination = `${options.target}/${source.skill}`;
	if (!options.host.exists(destination)) return "absent";

	return options.host.exists(`${destination}/${lankaSkillMarker}`) ? "managed" : "foreign";
};

/**
 * What a sync would do, decided before anything is written.
 *
 * Separate from doing it, so the same decision serves `sync`, `--dry-run` and
 * `list` — and so the one interesting rule, the refusal to overwrite a
 * directory this tool did not create, is testable without a file system.
 */
export const planLankaSkillSync = (options: IPlanLankaSkillSyncOptions): ILankaSkillSyncPlan => {
	const install: ILankaSkillSource[] = [];
	const update: ILankaSkillSource[] = [];
	const conflict: ILankaSkillSource[] = [];

	for (const source of options.sources) {
		const state = stateOf(options, source);

		if (state === "absent") install.push(source);
		else if (state === "managed" || options.force === true) update.push(source);
		else conflict.push(source);
	}

	return { install, update, conflict };
};
