import { findLankaSkillSources } from "../find-lanka-skill-sources/findLankaSkillSources";
import { lankaDefaultSkillTarget } from "../lanka-default-skill-target/lankaDefaultSkillTarget";
import { lankaSkillMarker } from "../lanka-skill-marker/lankaSkillMarker";
import { planLankaSkillSync } from "../plan-lanka-skill-sync/planLankaSkillSync";
import type { ILankaSkillHost } from "../_interfaces/ILankaSkillHost";
import type { ILankaSkillSource } from "../_interfaces/ILankaSkillSource";
import type { ILankaSkillSyncPlan } from "../_interfaces/ILankaSkillSyncPlan";

export interface ISyncLankaSkillsOptions {
	/** The consumer's project root. */
	root: string;
	host: ILankaSkillHost;
	/** Where to install, relative to the root. Defaults to `.claude/skills`. */
	target?: string;
	/** Replace a directory this tool did not write. */
	force?: boolean;
	/** Decide and report, write nothing. */
	dryRun?: boolean;
}

const marker = (source: ILankaSkillSource): string =>
	`${JSON.stringify({ package: source.packageName, version: source.version, skill: source.skill }, null, "\t")}\n`;

/**
 * Copies the skills of the installed lanka packages into the project.
 *
 * Returns the plan it carried out, so a caller prints one thing whether or not
 * anything was written: `--dry-run` differs in what happened, never in what is
 * reported.
 */
export const syncLankaSkills = (options: ISyncLankaSkillsOptions): ILankaSkillSyncPlan => {
	const { root, host } = options;
	const target = `${root}/${options.target ?? lankaDefaultSkillTarget}`;

	const sources = findLankaSkillSources({ root, host });
	const plan = planLankaSkillSync({ sources, target, host, force: options.force });

	if (options.dryRun === true) return plan;

	for (const source of [...plan.install, ...plan.update]) {
		const destination = `${target}/${source.skill}`;
		host.copyDirectory(source.dir, destination);
		// Written AFTER the copy, and last: a marker beside a half-copied directory
		// would promise the next run that it may replace something that was never
		// finished.
		host.writeTextFile(`${destination}/${lankaSkillMarker}`, marker(source));
	}

	return plan;
};
