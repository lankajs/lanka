import type { ILankaSortKey } from "../to-lanka-sort-key/toLankaSortKey";

/**
 * One collator, reused.
 *
 * `String.prototype.localeCompare` resolves the locale and its options on every
 * call unless the engine caches them; a collator built once cannot forget.
 */
const collator = new Intl.Collator(undefined);

/**
 * Orders two keys exactly as `compareLankaValues` orders the values behind them.
 *
 * The identity shortcut it opens with — `a === b` — is not repeated here: two
 * keys are never the same object, and the comparisons below answer 0 for equal
 * values anyway.
 */
export const compareLankaSortKeys = (left: ILankaSortKey, right: ILankaSortKey): number => {
	// Empty first, whatever it is being compared against.
	if (left.kind === 0) return right.kind === 0 ? 0 : -1;
	if (right.kind === 0) return 1;

	// Two dates or two numbers compare as themselves; a mixed pair falls through
	// to text, which is what comparing them one at a time did.
	if (left.kind === right.kind && left.kind !== 3) return left.num - right.num;

	return collator.compare(textOf(left), textOf(right));
};

/** The text a key compares by when the pair is not two dates or two numbers. */
const textOf = (key: ILankaSortKey): string => {
	if (key.kind === 3) return key.text;
	if (key.kind === 2) return new Date(key.num).toString().toLowerCase();

	return String(key.num);
};
