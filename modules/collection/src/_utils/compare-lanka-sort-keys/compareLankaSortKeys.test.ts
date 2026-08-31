import { describe, expect, it } from "vitest";
import { compareLankaSortKeys } from "./compareLankaSortKeys";
import { toLankaSortKey } from "../to-lanka-sort-key/toLankaSortKey";
import { compareLankaValues } from "../../compare-lanka-values/compareLankaValues";
import type { TLankaSortableValue } from "../../_types/TLankaSortableValue";

/**
 * The keys exist to say what `compareLankaValues` says, one step earlier.
 *
 * So the test is not "does this order look right" but "does it order the same
 * pairs the same way" — an optimisation that sorted correctly by its own lights
 * and differently from the published rule would be a table that reorders itself
 * for no reason a user can name.
 */
const sign = (value: number): number => Math.sign(value);

const bothWays = (left: TLankaSortableValue, right: TLankaSortableValue): void => {
	expect(sign(compareLankaSortKeys(toLankaSortKey(left), toLankaSortKey(right)))).toBe(
		sign(compareLankaValues(left, right)),
	);
	expect(sign(compareLankaSortKeys(toLankaSortKey(right), toLankaSortKey(left)))).toBe(
		sign(compareLankaValues(right, left)),
	);
};

describe("compareLankaSortKeys", () => {
	it("orders two numbers, two dates and two strings as the rule does", () => {
		bothWays(1, 2);
		bothWays(new Date(1_700_000_000_000), new Date(1_700_000_001_000));
		bothWays("apple", "banana");
	});

	it("puts an empty cell first, whatever it is next to", () => {
		bothWays(null, "anything");
		bothWays(null, 0);
		bothWays(undefined, new Date(0));
	});

	it("compares a mixed pair as text, which is what the rule falls back to", () => {
		// A column holding a date in one row and a string in another: nothing
		// sensible orders them, and both sides agree on the same nonsense.
		bothWays(new Date(1_700_000_000_000), "a string");
		bothWays(42, "a string");
		bothWays(new Date(1_700_000_000_000), 42);
	});

	it("answers 0 for two empty cells, in both directions", () => {
		// The one place the keys differ from the rule they replaced, deliberately:
		// `null` against `undefined` used to answer -1 BOTH ways, which says each
		// is smaller than the other. Equal is the only self-consistent answer.
		expect(compareLankaSortKeys(toLankaSortKey(null), toLankaSortKey(undefined))).toBe(0);
		expect(compareLankaSortKeys(toLankaSortKey(undefined), toLankaSortKey(null))).toBe(0);
	});

	it("treats a shape nobody read a field out of as its text, as the rule does", () => {
		const shape = { toString: () => "zzz" } as unknown as TLankaSortableValue;

		bothWays(shape, "aaa");
	});
});
