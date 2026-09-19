/**
 * One npm package a plan would add, and which list it goes in.
 *
 * **No version, ever.** The range comes from the package manager the project
 * already uses, which is asked to add the name; a range written here would be
 * whatever was current on the day this tool was built, which is the one number
 * it cannot know. That is also why a plan can be printed without an install
 * having happened: the names are the whole of what this decides.
 */
export interface ILankaInitDependency {
	readonly name: string;
	/** Whether it is added with the package manager's development flag. */
	readonly dev: boolean;
	/** Which answer put it here — the template's id, or an axis answer's. */
	readonly from: string;
}
