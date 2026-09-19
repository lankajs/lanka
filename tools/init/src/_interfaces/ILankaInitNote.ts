/**
 * Something the project must still do, which this command deliberately did not.
 *
 * An object from the first version rather than a bare string, because notes are
 * printed by this package and read by whatever embeds it — and a list of
 * sentences somebody wants to group, filter or link is a list somebody parses.
 * `skills/surface/SKILL.md` 6c: changing a return shape later costs a second
 * name that lives forever.
 */
export interface ILankaInitNote {
	/** What the note is about: a package name, a file, an axis. */
	readonly subject: string;
	readonly text: string;
}
