import type { ILankaInitNote } from "./ILankaInitNote";

/** One run of the project's package manager, and what it answered. */
export interface ILankaInitInstall {
	readonly command: string;
	readonly args: readonly string[];
	/** Zero when it succeeded. Anything else is the package manager's own answer. */
	readonly code: number;
}

/** A file this run created, and what it is for. */
export interface ILankaInitWritten {
	readonly path: string;
	readonly gist: string;
}

/** A file that was already there, and was therefore left exactly as it was. */
export interface ILankaInitKept {
	readonly path: string;
	/** Why it was left, and what the project may still have to do itself. */
	readonly reason: string;
}

/**
 * What a run did, in the lists a person needs to check it by.
 *
 * Objects rather than bare paths, from the first version: "kept" without a
 * reason is the one line somebody will want to act on, and growing a reason onto
 * a `readonly string[]` later would mean a second type name that lives forever.
 */
export interface ILankaInitOutcome {
	readonly written: readonly ILankaInitWritten[];
	readonly kept: readonly ILankaInitKept[];
	/**
	 * The package manager runs, in order.
	 *
	 * Three states and not two, because a reader acts differently on each.
	 * `null` is "never asked" — a dry run, or `--no-install`, where the
	 * dependencies are still the project's to add. An empty list is "asked, and
	 * there was nothing missing", which is the ordinary answer to running this a
	 * second time and has to be said out loud: silence where an install was
	 * expected reads as an install that failed.
	 */
	readonly installs: readonly ILankaInitInstall[] | null;
	/** The plan's notes, plus whatever this run found out by looking at the disk. */
	readonly notes: readonly ILankaInitNote[];
	/** Whether anything was actually written. */
	readonly dryRun: boolean;
}
