/**
 * What one row is compared BY, worked out once instead of on every comparison.
 *
 * `compareLankaValues` decides afresh, per pair, whether it is looking at two
 * dates, two numbers or two strings — and for strings it builds two lowercased
 * copies before comparing them. A sort of a thousand rows asks it about ten
 * thousand pairs, so it does that work twenty thousand times for a thousand
 * values.
 *
 * A key holds the decision instead: the kind, the number a date or a number
 * compares by, and the lowercased text everything else compares by. The rules
 * are `compare-lanka-values`', unchanged — this is where they are applied, not a
 * second opinion about ordering.
 */
export interface ILankaSortKey {
	/** 0 empty, 1 number, 2 date, 3 text — the order the branches are tried in. */
	kind: 0 | 1 | 2 | 3;
	num: number;
	text: string;
}

const EMPTY: ILankaSortKey = { kind: 0, num: 0, text: "" };

/** The key one value sorts by. */
export const toLankaSortKey = (value: unknown): ILankaSortKey => {
	if (value == null) return EMPTY;
	if (typeof value === "number") return { kind: 1, num: value, text: "" };
	if (value instanceof Date) return { kind: 2, num: value.getTime(), text: "" };

	// `[object Object]` included, and on purpose: it is what `compareLankaValues`
	// does with a shape nobody read a field out of, and a key that decided
	// otherwise would sort differently from the rule it is applying.
	// eslint-disable-next-line @typescript-eslint/no-base-to-string
	return { kind: 3, num: 0, text: String(value).toLowerCase() };
};
