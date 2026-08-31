import { describe, expect, it } from "vitest";
import { createLankaFilterer } from "./createLankaFilterer";
import { lankaFilterMatchers } from "../../lanka-filter-matchers/lankaFilterMatchers";
import type { ILankaFilterRule } from "../../_interfaces/ILankaFilterRule";

interface IRow {
	name: string;
	age: number;
	role: { name: string };
}

const rows: IRow[] = [
	{ name: "Ada", age: 36, role: { name: "admin" } },
	{ name: "Grace", age: 45, role: { name: "viewer" } },
	{ name: "Alan", age: 41, role: { name: "admin" } },
];

const read = (row: IRow, field: string) => row[field as keyof IRow] as string | number;

describe("filtering a list", () => {
	it("defaults to what a search box means", () => {
		const filter = createLankaFilterer<IRow>(read);

		// `contains`, not `eq`: somebody typing "al" is looking for Alan.
		expect(filter(rows, [{ field: "name", value: "al" }]).map((row) => row.name)).toEqual([
			"Alan",
		]);
	});

	it("treats an empty filter value as no filter at all", () => {
		const filter = createLankaFilterer<IRow>(read);

		// A cleared search box asks for everything; matching "" against every row
		// would answer the same by accident rather than on purpose.
		expect(filter(rows, [{ field: "name", value: "" }])).toBe(rows);
	});

	it("answers with the SAME array when every row survives", () => {
		const filter = createLankaFilterer<IRow>(read);

		expect(filter(rows, [{ field: "age", value: 30, operator: "gte" }])).toBe(rows);
	});

	it("holds two conditions on one field, which an object keyed by field cannot", () => {
		const filter = createLankaFilterer<IRow>(read);
		const rules: ILankaFilterRule<IRow>[] = [
			{ field: "age", value: 40, operator: "gte" },
			{ field: "age", value: 44, operator: "lte" },
		];

		expect(filter(rows, rules).map((row) => row.name)).toEqual(["Alan"]);
	});

	it("reads a nested field through the rule's own reader", () => {
		const filter = createLankaFilterer<IRow>(read);
		const rules: ILankaFilterRule<IRow>[] = [
			{ field: "role", value: "admin", operator: "eq", getValue: (row) => row.role.name },
		];

		expect(filter(rows, rules)).toHaveLength(2);
	});

	it("lets a rule decide outright", () => {
		const filter = createLankaFilterer<IRow>(read);
		const rules: ILankaFilterRule<IRow>[] = [
			{ field: "name", value: 4, match: (itemValue) => String(itemValue).length === 4 },
		];

		expect(filter(rows, rules).map((row) => row.name)).toEqual(["Alan"]);
	});

	it("takes an eleventh operator as a table entry", () => {
		const filter = createLankaFilterer<IRow>(read, {
			...lankaFilterMatchers,
			// The point of a table over a switch: an application adds its own
			// without subclassing anything.
			eq: (itemValue, filterValue) => String(itemValue).length === Number(filterValue),
		});

		expect(filter(rows, [{ field: "name", value: 3, operator: "eq" }])).toHaveLength(1);
	});

	it("repeats its previous answer for the same arguments", () => {
		const filter = createLankaFilterer<IRow>(read);
		const rules: ILankaFilterRule<IRow>[] = [{ field: "name", value: "a" }];

		expect(filter(rows, rules)).toBe(filter(rows, rules));
	});

	it("returns the input when there is nothing to filter by", () => {
		const filter = createLankaFilterer<IRow>(read);

		expect(filter(rows, [])).toBe(rows);
	});
});

describe("createLankaFilterer — a rule that brings its own answer", () => {
	interface IRow {
		id: number;
		name: string;
	}

	const rows: IRow[] = [
		{ id: 1, name: "ann" },
		{ id: 2, name: "bob" },
	];

	const filter = createLankaFilterer<IRow>((row, field) => row[field as keyof IRow]);

	it("uses a rule's own matcher, whatever the operator says", () => {
		const kept = filter(rows, [
			{ field: "name", value: "anything", operator: "eq", match: (item) => item === "bob" },
		]);

		// `match` beats the operator: a rule that brought its own answer is not
		// asked the table's question. Compiling the rule must not lose that.
		expect(kept.map((row) => row.id)).toEqual([2]);
	});

	it("reads through a rule's own getValue rather than the field", () => {
		const kept = filter(rows, [
			{ field: "ignored", value: "ANN", operator: "eq", getValue: (row) => row.name },
		]);

		expect(kept.map((row) => row.id)).toEqual([1]);
	});

	it("keeps everything when one rule of several is empty", () => {
		const kept = filter(rows, [
			{ field: "name", value: "" },
			{ field: "id", value: 2, operator: "eq" },
		]);

		expect(kept.map((row) => row.id)).toEqual([2]);
	});
});
