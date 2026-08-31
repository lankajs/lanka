import { describe, expect, it } from "vitest";
import { lankaFilterMatchers } from "./lankaFilterMatchers";

describe("the ten operators", () => {
	it("compares equality without caring about case or type", () => {
		expect(lankaFilterMatchers.eq("Ada", "ada")).toBe(true);
		expect(lankaFilterMatchers.eq(36, "36")).toBe(true);
		expect(lankaFilterMatchers.eq("Ada", "Grace")).toBe(false);
	});

	it("compares two dates by their instant, not their object", () => {
		expect(lankaFilterMatchers.eq(new Date("2026-01-01"), new Date("2026-01-01"))).toBe(true);
	});

	it("says nothing is equal to nothing-in-particular", () => {
		// One side missing is not a match: a row with no value did not answer the
		// question, and treating that as equality hides empty rows in every filter.
		expect(lankaFilterMatchers.eq(null, "ada")).toBe(false);
		expect(lankaFilterMatchers.eq("ada", undefined)).toBe(false);
	});

	it("negates equality", () => {
		expect(lankaFilterMatchers.neq("Ada", "Grace")).toBe(true);
		expect(lankaFilterMatchers.neq("Ada", "ada")).toBe(false);
	});

	it("matches any of a list, and a bare value as a list of one", () => {
		expect(lankaFilterMatchers.in("admin", ["admin", "viewer"])).toBe(true);
		expect(lankaFilterMatchers.in("owner", ["admin", "viewer"])).toBe(false);
		expect(lankaFilterMatchers.in("admin", "admin")).toBe(true);
	});

	it("matches text by part, start and end", () => {
		expect(lankaFilterMatchers.contains("Grace Hopper", "hopp")).toBe(true);
		expect(lankaFilterMatchers.startsWith("Grace Hopper", "gra")).toBe(true);
		expect(lankaFilterMatchers.startsWith("Grace Hopper", "hopper")).toBe(false);
		expect(lankaFilterMatchers.endsWith("Grace Hopper", "PER")).toBe(true);
	});

	it("orders numbers as numbers", () => {
		expect(lankaFilterMatchers.gt(10, 9)).toBe(true);
		expect(lankaFilterMatchers.gte(9, 9)).toBe(true);
		expect(lankaFilterMatchers.lt(9, 10)).toBe(true);
		expect(lankaFilterMatchers.lte(9, 9)).toBe(true);
	});

	it("orders dates as dates", () => {
		expect(lankaFilterMatchers.gt(new Date("2026-05-02"), new Date("2026-04-19"))).toBe(true);
		expect(lankaFilterMatchers.lt(new Date("2026-04-19"), new Date("2026-05-02"))).toBe(true);
	});

	it("refuses to compare a shape nobody read a field out of", () => {
		// The alternative is "[object Object]", which matches every substring
		// search and orders every row the same — a filter that looks like it works.
		expect(lankaFilterMatchers.contains({ name: "Ada" }, "ada")).toBe(false);
		expect(lankaFilterMatchers.gte({ toString: () => "b" }, "a")).toBe(false);
	});

	it("puts an empty value first, as sorting does", () => {
		expect(lankaFilterMatchers.lte(null, "a")).toBe(true);
	});
});
