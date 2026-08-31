import { compareLankaSortKeys } from "../../_utils/compare-lanka-sort-keys/compareLankaSortKeys";
import { toLankaSortKey } from "../../_utils/to-lanka-sort-key/toLankaSortKey";
import { haveSameOrder } from "../../_utils/haveSameOrder";
import type { ILankaSortKey } from "../../_utils/to-lanka-sort-key/toLankaSortKey";
import type { ILankaSortState } from "../../_interfaces/ILankaSortState";
import type { TLankaValueReader } from "../../_types/TLankaValueReader";

/**
 * Sorting that answers with the array it was given whenever it can.
 *
 * Twice, in fact: the same arguments return the previous result, and a sort that
 * changed nothing returns the input itself. Both matter for the same reason — a
 * new array is a new prop for every row below it.
 */
export const createLankaSorter = <TItem>(getValue: TLankaValueReader<TItem>) => {
	let lastItems: readonly TItem[] | null = null;
	let lastState: ILankaSortState | null = null;
	let lastResult: readonly TItem[] = [];

	return (items: readonly TItem[], state: ILankaSortState): readonly TItem[] => {
		if (
			lastItems === items &&
			lastState?.field === state.field &&
			lastState.order === state.order
		) {
			return lastResult;
		}

		const sorted =
			state.field === null || state.order === null
				? items
				: sortBy(items, state.field, state.order === "asc" ? 1 : -1, getValue);

		lastItems = items;
		lastState = state;
		lastResult = haveSameOrder(sorted, items) ? items : sorted;

		return lastResult;
	};
};

/**
 * Sorts by a key worked out once per row rather than once per comparison.
 *
 * A thousand rows is ten thousand comparisons, and the naive form asks each of
 * them to read the field twice and decide afresh what kind of value it is — for
 * text, building two lowercased copies to throw away. Reading the field once per
 * ROW turns twenty thousand of those into a thousand, and measured that way the
 * sort costs 17 000 yardsticks where it used to cost 24 000.
 *
 * The ordering is `compareLankaValues`', unchanged: `compareLankaSortKeys`
 * applies the same three rules to the same values, one step later.
 */
const sortBy = <TItem>(
	items: readonly TItem[],
	field: string,
	direction: number,
	getValue: TLankaValueReader<TItem>,
): TItem[] => {
	const size = items.length;
	const decorated = new Array<{ item: TItem; key: ILankaSortKey }>(size);

	for (let index = 0; index < size; index += 1) {
		const item = items[index];
		decorated[index] = { item, key: toLankaSortKey(getValue(item, field)) };
	}

	decorated.sort((left, right) => compareLankaSortKeys(left.key, right.key) * direction);

	const sorted = new Array<TItem>(size);
	for (let index = 0; index < size; index += 1) sorted[index] = decorated[index].item;

	return sorted;
};
