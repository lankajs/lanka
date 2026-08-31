import { describe, expect, it } from "vitest";
import { buildLankaQueryParams } from "./buildLankaQueryParams";

/**
 * Query parameter building is live code on a hot path: EVERY list request goes
 * through it.
 *
 * What is pinned is the encoding shape rather than the fact of a call: how
 * nesting and arrays turn into a string is a CONTRACT with the backend. Changing
 * it silently breaks parsing on the other side, and no test higher up the stack
 * notices — the request goes out, a response comes back, just not the right one.
 */

const asString = (params: URLSearchParams): string => decodeURIComponent(params.toString());

describe("buildLankaQueryParams", () => {
	it("encodes primitive values", () => {
		expect(asString(buildLankaQueryParams({ page: 2, search: "ann", active: true }))).toBe(
			"page=2&search=ann&active=true",
		);
	});

	it("skips `null` and `undefined` instead of stringifying them", () => {
		// An "undefined" in a query is almost always a backend-side bug: it receives
		// a nine-letter string where it expected the parameter to be absent.
		expect(asString(buildLankaQueryParams({ a: 1, b: null, c: undefined }))).toBe("a=1");
	});

	it("keeps `0`, `false` and the empty string — they are values, not absence", () => {
		expect(asString(buildLankaQueryParams({ a: 0, b: false, c: "" }))).toBe("a=0&b=false&c=");
	});

	it("an array is encoded as `key[]`, repeating the key", () => {
		expect(asString(buildLankaQueryParams({ ids: [1, 2, 3] }))).toBe("ids[]=1&ids[]=2&ids[]=3");
	});

	it("an object is encoded as `key[field]`", () => {
		expect(asString(buildLankaQueryParams({ filter: { status: "open", owner: 7 } }))).toBe(
			"filter[status]=open&filter[owner]=7",
		);
	});

	it("arbitrary nesting keeps the whole path", () => {
		expect(asString(buildLankaQueryParams({ filter: { range: { from: "2026-01-01" } } }))).toBe(
			"filter[range][from]=2026-01-01",
		);
	});

	it("an array inside an object combines both forms", () => {
		expect(asString(buildLankaQueryParams({ filter: { ids: [1, 2] } }))).toBe(
			"filter[ids][]=1&filter[ids][]=2",
		);
	});

	it("`null` inside an array is skipped without shifting the rest", () => {
		expect(asString(buildLankaQueryParams({ ids: [1, null, 3] }))).toBe("ids[]=1&ids[]=3");
	});

	it("an empty object yields an empty string, not `?`", () => {
		expect(asString(buildLankaQueryParams({}))).toBe("");
	});

	it("an empty array adds no key", () => {
		expect(asString(buildLankaQueryParams({ ids: [], page: 1 }))).toBe("page=1");
	});

	it("values are escaped", () => {
		// Without escaping, an `&` inside a value would split the parameter in two
		// and the server would read two parameters instead of one.
		expect(buildLankaQueryParams({ q: "a&b=c" }).toString()).toBe("q=a%26b%3Dc");
	});

	/*
	 * There is deliberately no date case. `TLankaQueryParams` does not accept one —
	 * the type requires a primitive, an array or a record — so passing a `Date`
	 * does not compile. A test for behaviour that cannot happen would be testing a
	 * type assertion rather than parameter building.
	 */
});
