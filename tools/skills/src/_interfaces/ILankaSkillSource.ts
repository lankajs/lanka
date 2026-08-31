/**
 * One skill directory found inside an installed package.
 *
 * The version is carried because it is the whole point of this transport: a
 * skill copied out of `node_modules` describes the code the application is
 * running, and the record says which.
 */
export interface ILankaSkillSource {
	/** The npm package the skill came from. */
	packageName: string;
	/** The version in `node_modules` — what the skill actually describes. */
	version: string;
	/** The skill's directory name, which is also the name an agent sees. */
	skill: string;
	/** Absolute path of the directory to copy. */
	dir: string;
}
