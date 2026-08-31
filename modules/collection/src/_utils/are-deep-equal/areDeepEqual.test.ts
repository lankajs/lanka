import { describe, expect, it } from "vitest";
import { areDeepEqual } from "./areDeepEqual";

/**
 * What a refetch is recognised by.
 *
 * Rows come back out of a fresh `JSON.parse`, so identity answers nothing and
 * this is what stands between "the data is the same" and every row in the table
 * re-rendering twice a minute.
 */
describe("areDeepEqual", () => {
	it("recognises identical data in different objects", () => {
		expect(areDeepEqual({ id: 1, at: new Date(5) }, { id: 1, at: new Date(5) })).toBe(true);
	});

	it("refuses arrays of different lengths, and one that is not an array", () => {
		expect(areDeepEqual([1, 2], [1, 2, 3])).toBe(false);
		expect(areDeepEqual([1], { 0: 1 })).toBe(false);
		expect(areDeepEqual([1, 2], [1, 3])).toBe(false);
	});

	it("refuses a key one side has and the other does not", () => {
		// Same count, different names: the shortest path to a wrong `true`.
		expect(areDeepEqual({ a: 1, b: 2 }, { a: 1, c: 2 })).toBe(false);
	});

	it("refuses when one side is not an object at all", () => {
		expect(areDeepEqual({ a: 1 }, "a")).toBe(false);
		expect(areDeepEqual(null, { a: 1 })).toBe(false);
	});
});
