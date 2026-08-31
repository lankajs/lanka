import type { ILankaPage } from "../../_interfaces/ILankaPage";

/**
 * One page of a list, memoised on the arguments it was given.
 *
 * A page that covers the whole list IS the list — the same array, not a copy of
 * it — because the commonest table has fewer rows than its page size, and
 * slicing it would hand React a new array on every keystroke elsewhere.
 */
export const createLankaPaginator = <TItem>() => {
	let lastItems: readonly TItem[] | null = null;
	let lastPage = 0;
	let lastLimit = 0;
	let lastResult: ILankaPage<TItem> = { items: [], totalPages: 1 };

	return (items: readonly TItem[], page: number, limit: number): ILankaPage<TItem> => {
		if (lastItems === items && lastPage === page && lastLimit === limit) return lastResult;

		const safeLimit = limit > 0 ? limit : 1;
		const start = (page - 1) * safeLimit;
		const end = start + safeLimit;

		lastItems = items;
		lastPage = page;
		lastLimit = limit;
		lastResult = {
			items: start === 0 && end >= items.length ? items : items.slice(start, end),
			totalPages: Math.max(1, Math.ceil(items.length / safeLimit)),
		};

		return lastResult;
	};
};
