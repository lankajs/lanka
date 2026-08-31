import { createLankaFilterer } from "../../_internal/create-lanka-filterer/createLankaFilterer";
import { createLankaPaginator } from "../../_internal/create-lanka-paginator/createLankaPaginator";
import { createLankaSorter } from "../../_internal/create-lanka-sorter/createLankaSorter";
import { createLankaStabiliser } from "../../_internal/create-lanka-stabiliser/createLankaStabiliser";
import type { ILankaFilterRule } from "../../_interfaces/ILankaFilterRule";
import type { ILankaPage } from "../../_interfaces/ILankaPage";
import type { ILankaSortState } from "../../_interfaces/ILankaSortState";
import type { TLankaFilterMatcher } from "../../_types/TLankaFilterMatcher";
import type { TLankaFilterOperator } from "../../_types/TLankaFilterOperator";
import type { TLankaValueReader } from "../../_types/TLankaValueReader";

/** What one list's view is built from. */
export interface ILankaCollectionViewConfig<TItem, TId extends string | number> {
	/** Reads a field out of a row: nested paths and computed columns live here. */
	getValue: TLankaValueReader<TItem>;
	/** Recognises a row across refetches. Without it, nothing is stabilised. */
	getId?: (item: TItem) => TId;
	/** Replaces or extends the ten operators. */
	matchers?: Record<TLankaFilterOperator, TLankaFilterMatcher>;
}

/**
 * One list's sort, filter, page and stabilisation, each remembering its last
 * answer.
 *
 * ONE view per list, held for as long as the list is: the memory is the whole
 * product, and a view rebuilt on every render remembers nothing. In a ViewModel
 * that means building it beside the state rather than inside an action.
 *
 * The four are separate calls rather than one pipeline because their ORDER is
 * the application's: filter-then-sort and sort-then-filter give the same rows,
 * but paginating before filtering gives a different page, and only the screen
 * knows which it means.
 */
export const createLankaCollectionView = <TItem, TId extends string | number = string>(
	config: ILankaCollectionViewConfig<TItem, TId>,
) => {
	const sort = createLankaSorter<TItem>(config.getValue);
	const filter = createLankaFilterer<TItem>(config.getValue, config.matchers);
	const paginate = createLankaPaginator<TItem>();
	const stabilise = config.getId
		? createLankaStabiliser<TItem, TId>({ getId: config.getId })
		: null;

	return {
		sort: (items: readonly TItem[], state: ILankaSortState): readonly TItem[] =>
			sort(items, state),

		filter: (items: readonly TItem[], rules: readonly ILankaFilterRule<TItem>[]) =>
			filter(items, rules),

		paginate: (items: readonly TItem[], page: number, limit: number): ILankaPage<TItem> =>
			paginate(items, page, limit),

		/**
		 * Reuses the previous object for every row whose contents are unchanged.
		 *
		 * Answers the input untouched when the view was built without `getId`:
		 * without a way to recognise a row there is nothing to keep, and guessing
		 * one — by index, by JSON — is how a sorted list starts swapping identities.
		 */
		stabilise: (items: readonly TItem[]): readonly TItem[] =>
			stabilise ? stabilise(items) : items,
	};
};
