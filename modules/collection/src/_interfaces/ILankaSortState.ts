import type { TLankaSortOrder } from "../_types/TLankaSortOrder";

/** What a table header shows, and what a sort is done by. */
export interface ILankaSortState {
	field: string | null;
	order: TLankaSortOrder;
}
