import { areDeepEqual } from "../../_utils/are-deep-equal/areDeepEqual";

/** What a row is recognised by, and when two versions of it count as the same. */
export interface ILankaStabiliserConfig<TItem, TId extends string | number> {
	getId: (item: TItem) => TId;
	/** Defaults to a deep comparison, which is what a refetch needs. */
	areEqual?: (previous: TItem, next: TItem) => boolean;
}

/**
 * Keeps the OBJECTS a list is made of when a refetch returned the same data.
 *
 * The other three operations preserve the array; this preserves its contents. A
 * poll every thirty seconds hands back rows parsed out of fresh JSON — different
 * objects, identical data — and without this every row in the table re-renders
 * twice a minute for nothing.
 *
 * A row that genuinely changed is replaced, and only that row.
 */
export const createLankaStabiliser = <TItem, TId extends string | number>(
	config: ILankaStabiliserConfig<TItem, TId>,
) => {
	const areEqual = config.areEqual ?? areDeepEqual;
	let previous: readonly TItem[] | null = null;
	let byId = new Map<TId, TItem>();

	return (items: readonly TItem[]): readonly TItem[] => {
		if (previous === null) {
			previous = items;
			byId = new Map(items.map((item) => [config.getId(item), item]));
			return items;
		}

		// The array it was handed last time, handed back: every row would map to
		// itself and the answer would be `previous` after a full pass of deep
		// comparisons. A re-render does exactly this, and it is the commonest call
		// there is.
		if (previous === items) return previous;

		const next = keepKnownRows(items, previous, byId, config.getId, areEqual);
		if (next === previous) return previous;

		previous = next;

		// Rebuilt only when the answer changed. The map is keyed by id and holds
		// the objects now in `next` — when nothing changed it already does.
		byId = new Map(next.map((item) => [config.getId(item), item]));

		return next;
	};
};

/**
 * The list again, with every row that did not change kept as the OBJECT it was.
 *
 * Answers `previous` itself when every row was kept — the caller then knows
 * nothing changed without walking the list a second time to find out what this
 * pass already knew.
 */
const keepKnownRows = <TItem, TId extends string | number>(
	items: readonly TItem[],
	previous: readonly TItem[],
	byId: Map<TId, TItem>,
	getId: (item: TItem) => TId,
	areEqual: (previousItem: TItem, nextItem: TItem) => boolean,
): readonly TItem[] => {
	const size = items.length;
	const next = new Array<TItem>(size);
	let allKnown = size === previous.length;

	for (let index = 0; index < size; index += 1) {
		const item = items[index];
		const known = byId.get(getId(item));
		const kept = known !== undefined && areEqual(known, item) ? known : item;

		next[index] = kept;
		if (allKnown && kept !== previous[index]) allKnown = false;
	}

	return allKnown ? previous : next;
};
