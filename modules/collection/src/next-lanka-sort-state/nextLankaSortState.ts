import type { ILankaSortState } from "../_interfaces/ILankaSortState";

/**
 * What a header click does: ascending, descending, off.
 *
 * Three states rather than two because the third is the only way back to the
 * order the server sent, and a table where sorting cannot be undone forces a
 * reload to see it.
 *
 * A pure function of the current state, and deliberately not something handed a
 * store's `set`/`get`: the ViewModel already owns writing, and a helper that
 * writes for it works with exactly one state library.
 */
export const nextLankaSortState = (
	current: ILankaSortState,
	clickedField: string,
): ILankaSortState => {
	if (current.field !== clickedField) return { field: clickedField, order: "asc" };
	if (current.order === "asc") return { field: clickedField, order: "desc" };
	if (current.order === "desc") return { field: null, order: null };

	return { field: clickedField, order: "asc" };
};
