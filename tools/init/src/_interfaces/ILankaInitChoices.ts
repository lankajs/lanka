import type { ILankaInitAnswer } from "./ILankaInitAnswer";
import type { ILankaInitTemplate } from "./ILankaInitTemplate";

/**
 * Every decision, resolved: what was typed, what was answered and what defaulted,
 * with no way left to tell which was which.
 *
 * That last part is deliberate. Everything downstream — the plan, the files, the
 * install — reads a project that has been DECIDED, and a field remembering
 * whether a person or a default decided it is a field something eventually
 * branches on.
 *
 * The answers are the catalog's own entries and not their ids. An id would make
 * every reader downstream look it up again, and a lookup that can fail is a
 * failure mode in four places rather than one: an id this package does not know
 * is refused where it is READ, by name, and nothing below here can meet one.
 */
export interface ILankaInitChoices {
	readonly template: ILankaInitTemplate;
	readonly validator: ILankaInitAnswer;
	readonly transport: ILankaInitAnswer;
	readonly storage: ILankaInitAnswer;
	/** In catalog order, whatever order they were typed in. */
	readonly extras: readonly ILankaInitAnswer[];
	/** What the host's `apiBaseUrl` is written as. */
	readonly apiBaseUrl: string;
	/** The project root every path in the plan is relative to. */
	readonly root: string;
}
