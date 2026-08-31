import type { TLankaSortableValue } from "../_types/TLankaSortableValue";

/**
 * Orders two values of whatever type a row happens to hold.
 *
 * Three decisions worth stating, because each is visible in a table and none is
 * obvious:
 *
 * - **empty sorts first.** A row with nothing in the column is a row the user is
 *   usually looking for — the one nobody filled in.
 * - **dates and numbers compare as themselves.** Sorting a date as a string puts
 *   the 2nd of May after the 19th of April and looks like a bug in the server.
 * - **everything else compares as lower-case text**, through `localeCompare`, so
 *   "Ä" lands beside "A" rather than after "Z".
 */
export const compareLankaValues = (a: TLankaSortableValue, b: TLankaSortableValue): number => {
	if (a === b) return 0;
	if (a == null) return -1;
	if (b == null) return 1;

	if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
	if (typeof a === "number" && typeof b === "number") return a - b;

	return String(a).toLowerCase().localeCompare(String(b).toLowerCase());
};
