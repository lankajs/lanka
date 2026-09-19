/**
 * The least a question needs in order to show one of its answers.
 *
 * Both a template and an axis answer satisfy it, which is what lets ONE question
 * shape ask every question this command asks. The alternative was converting
 * templates into answers with two empty package lists — a shape invented to
 * satisfy a type, carrying fields that mean nothing.
 */
export interface ILankaInitLabel {
	readonly id: string;
	readonly title: string;
	readonly gist: string;
}

/**
 * One question, with every answer it accepts.
 *
 * Handed to the port rather than printed here, so what a person SEES is the
 * adapter's business and what is ASKED is this package's. A test supplies a port
 * answering from a list, and the whole decision tree becomes a unit test rather
 * than something discovered by typing at a terminal.
 */
export interface ILankaInitQuestion {
	/** What is being chosen: `template`, `validator`, `transport`, `storage`, `extras`. */
	readonly subject: string;
	/** One sentence, phrased as a question. */
	readonly prompt: string;
	readonly answers: readonly ILankaInitLabel[];
	/** The answer an empty reply means. */
	readonly defaultId: string;
	/**
	 * Whether several answers may be taken at once.
	 *
	 * True for the extras alone. A field rather than a second port member,
	 * because an adapter rendering one question renders both: what differs is
	 * whether the reply is split on commas.
	 */
	readonly multiple: boolean;
}
