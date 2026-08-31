import { compareLankaValues } from "../compare-lanka-values/compareLankaValues";
import type { TLankaFilterMatcher } from "../_types/TLankaFilterMatcher";
import type { TLankaFilterOperator } from "../_types/TLankaFilterOperator";
import type { TLankaSortableValue } from "../_types/TLankaSortableValue";

/**
 * Case-insensitive text, which is what every one of these means in a filter.
 *
 * An object is answered as empty rather than as "[object Object]": that string
 * matches every substring search and would quietly make a filter useless on a
 * column whose value is a shape somebody forgot to read a field out of.
 */
const text = (value: unknown): string => {
	if (value == null) return "";
	if (value instanceof Date) return value.toISOString().toLowerCase();
	if (typeof value === "string") return value.toLowerCase();
	if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
		return String(value).toLowerCase();
	}

	// An object, a function, a symbol: nothing a filter can read.
	return "";
};

/** Dates stay dates; everything else becomes something comparable. */
const comparable = (value: unknown): TLankaSortableValue => {
	if (value instanceof Date) return value;
	if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
		return value;
	}
	// Same refusal as `text`: an unread shape compares as nothing rather than as
	// a string every comparison happens to accept.
	return undefined;
};

const equal: TLankaFilterMatcher = (itemValue, filterValue) => {
	if (itemValue === filterValue) return true;
	if (itemValue == null || filterValue == null) return false;
	if (itemValue instanceof Date && filterValue instanceof Date) {
		return itemValue.getTime() === filterValue.getTime();
	}
	return text(itemValue) === text(filterValue);
};

/**
 * The ten operators, as a table.
 *
 * A table rather than a `switch` for one reason: a consumer with an eleventh —
 * "within this radius", "matches this regex" — adds an entry instead of
 * subclassing something. The framework's own ten are ordinary entries in it, and
 * an application may replace one it disagrees with.
 */
export const lankaFilterMatchers: Record<TLankaFilterOperator, TLankaFilterMatcher> = Object.freeze(
	{
		eq: equal,
		neq: (itemValue, filterValue) => !equal(itemValue, filterValue),
		in: (itemValue, filterValue) =>
			(Array.isArray(filterValue) ? filterValue : [filterValue]).some((candidate) =>
				equal(itemValue, candidate),
			),

		contains: (itemValue, filterValue) => text(itemValue).includes(text(filterValue)),
		startsWith: (itemValue, filterValue) => text(itemValue).startsWith(text(filterValue)),
		endsWith: (itemValue, filterValue) => text(itemValue).endsWith(text(filterValue)),

		gt: (itemValue, filterValue) =>
			compareLankaValues(comparable(itemValue), comparable(filterValue)) > 0,
		gte: (itemValue, filterValue) =>
			compareLankaValues(comparable(itemValue), comparable(filterValue)) >= 0,
		lt: (itemValue, filterValue) =>
			compareLankaValues(comparable(itemValue), comparable(filterValue)) < 0,
		lte: (itemValue, filterValue) =>
			compareLankaValues(comparable(itemValue), comparable(filterValue)) <= 0,
	},
);
