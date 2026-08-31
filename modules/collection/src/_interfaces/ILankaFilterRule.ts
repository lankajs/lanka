import type { TLankaFilterMatcher } from "../_types/TLankaFilterMatcher";
import type { TLankaFilterOperator } from "../_types/TLankaFilterOperator";

/** One condition a row must satisfy to survive a filter. */
export interface ILankaFilterRule<TItem> {
	field: string;
	value: unknown;
	/** Defaults to `contains`, which is what a search box means. */
	operator?: TLankaFilterOperator;
	/** Reads the value for THIS rule, when the field is not a plain property. */
	getValue?: (item: TItem) => unknown;
	/** Decides this rule outright. Beats the operator. */
	match?: TLankaFilterMatcher;
}
