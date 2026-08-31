import { describe, expect, it } from "vitest";
import { createLankaSorter } from "./createLankaSorter";

interface IRow {
	name: string;
	age: number;
}

const rows: IRow[] = [
	{ name: "Ada", age: 36 },
	{ name: "Grace", age: 45 },
	{ name: "Alan", age: 41 },
];

const read = (row: IRow, field: string) => row[field as keyof IRow];

describe("sorting a list", () => {
	it("orders by the field it was asked for", () => {
		const sort = createLankaSorter<IRow>(read);

		expect(sort(rows, { field: "age", order: "asc" }).map((row) => row.age)).toEqual([
			36, 41, 45,
		]);
	});

	it("answers with the SAME array when nothing is sorted", () => {
		const sort = createLankaSorter<IRow>(read);

		// Not an equal array — the same one. A new array is a new prop for every
		// row below it, which is the whole reason this package exists.
		expect(sort(rows, { field: null, order: null })).toBe(rows);
	});

	it("answers with the same array when the sort changed no order", () => {
		const sorted = [
			{ name: "Ada", age: 36 },
			{ name: "Alan", age: 41 },
		];
		const sort = createLankaSorter<IRow>(read);

		expect(sort(sorted, { field: "age", order: "asc" })).toBe(sorted);
	});

	it("repeats its previous answer for the same arguments", () => {
		const sort = createLankaSorter<IRow>(read);

		const first = sort(rows, { field: "name", order: "desc" });
		const second = sort(rows, { field: "name", order: "desc" });

		expect(second).toBe(first);
	});

	it("answers again when the order changes", () => {
		const sort = createLankaSorter<IRow>(read);

		const ascending = sort(rows, { field: "name", order: "asc" });
		const descending = sort(rows, { field: "name", order: "desc" });

		expect(descending).not.toBe(ascending);
		expect(descending.map((row) => row.name)).toEqual(["Grace", "Alan", "Ada"]);
	});

	it("leaves the list it was given untouched", () => {
		const sort = createLankaSorter<IRow>(read);

		sort(rows, { field: "age", order: "desc" });

		expect(rows.map((row) => row.age)).toEqual([36, 45, 41]);
	});
});
