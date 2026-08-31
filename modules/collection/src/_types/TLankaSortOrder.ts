/**
 * Ascending, descending, or not sorted at all.
 *
 * `null` is a state, not an absence: a column the user switched OFF is different
 * from one they never touched only in that both show the server's order, and a
 * table that cannot express it makes the third header click do nothing.
 */
export type TLankaSortOrder = "asc" | "desc" | null;
