import { compareLankaValues, lankaFilterMatchers } from "../../src/index";
import type { TLankaFilterMatcher, TLankaFilterOperator } from "../../src/index";

/**
 * The ten operators plus one this application needed.
 *
 * "Hired before" is a date comparison the package could have shipped and
 * deliberately did not: every application has one of these, and none of them is
 * the same. A table entry is the whole cost — no subclass, no fork, and the ten
 * that came with the package keep working beside it.
 *
 * It reuses `compareLankaValues` rather than writing `<`: dates, numbers and
 * text each order differently, and the package already decided how.
 */
export const playgroundHiredBeforeMatchers: Record<TLankaFilterOperator, TLankaFilterMatcher> = {
	...lankaFilterMatchers,
	lt: (itemValue, filterValue) =>
		itemValue instanceof Date && filterValue instanceof Date
			? compareLankaValues(itemValue, filterValue) < 0
			: lankaFilterMatchers.lt(itemValue, filterValue),
};
