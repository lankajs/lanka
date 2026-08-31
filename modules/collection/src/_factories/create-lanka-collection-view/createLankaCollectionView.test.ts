import { describe, expect, it } from "vitest";
import { createLankaCollectionView } from "./createLankaCollectionView";

interface IRow {
	id: number;
	name: string;
}

const rows: IRow[] = [
	{ id: 1, name: "Ada" },
	{ id: 2, name: "Grace" },
];

describe("one list's view", () => {
	it("hands the four operations one reader and one identity", () => {
		const view = createLankaCollectionView<IRow, number>({
			getValue: (row, field) => row[field as "name"],
			getId: (row) => row.id,
		});

		expect(view.sort(rows, { field: "name", order: "desc" }).map((row) => row.name)).toEqual([
			"Grace",
			"Ada",
		]);
		expect(view.filter(rows, [{ field: "name", value: "ada" }])).toHaveLength(1);
		expect(view.paginate(rows, 1, 1).totalPages).toBe(2);
	});

	it("stabilises nothing when it was given no way to recognise a row", () => {
		const view = createLankaCollectionView<IRow>({ getValue: (row) => row.name });
		const parsedAgain = JSON.parse(JSON.stringify(rows)) as IRow[];

		// Guessing an identity — by index, by JSON — is how a sorted list starts
		// swapping rows around. Answering the input is the honest refusal.
		expect(view.stabilise(parsedAgain)).toBe(parsedAgain);
	});

	it("remembers per operation, so one changing does not reset the others", () => {
		const view = createLankaCollectionView<IRow, number>({
			getValue: (row, field) => row[field as "name"],
			getId: (row) => row.id,
		});
		const sorted = view.sort(rows, { field: "name", order: "asc" });

		view.paginate(rows, 2, 1);

		expect(view.sort(rows, { field: "name", order: "asc" })).toBe(sorted);
	});
});

describe("createLankaCollectionView — what the memo promises a screen", () => {
	interface IRow {
		id: number;
		title: string;
	}

	const rows: IRow[] = [
		{ id: 1, title: "b" },
		{ id: 2, title: "a" },
	];

	const view = () =>
		createLankaCollectionView<IRow, number>({
			getValue: (row, field) => row[field as keyof IRow],
			getId: (row) => row.id,
		});

	it("answers the same array object when the arguments have not changed", () => {
		const collection = view();
		const state = { field: "title", order: "asc" as const };

		const first = collection.sort(rows, state);
		const second = collection.sort(rows, state);

		// Not "equal" — the SAME object. A new array is a new prop for every row
		// below it, so an optimisation that rebuilds the result on every call is a
		// full re-render of the table dressed as a faster sort. The benches measure
		// both sides of this exact memo.
		expect(second).toBe(first);
	});

	it("answers a new array when the sort actually changed", () => {
		const collection = view();

		const ascending = collection.sort(rows, { field: "title", order: "asc" });
		const descending = collection.sort(rows, { field: "title", order: "desc" });

		expect(descending).not.toBe(ascending);
		expect(descending.map((row) => row.id)).toEqual([1, 2]);
	});

	it("keeps every row object it can when the list is stabilised", () => {
		const collection = view();
		const sorted = collection.sort(rows, { field: "title", order: "asc" });

		const stabilised = collection.stabilise([
			{ id: 2, title: "a" },
			{ id: 1, title: "b" },
		]);
		const again = collection.stabilise([
			{ id: 2, title: "a" },
			{ id: 1, title: "b" },
		]);

		expect(sorted).toBeDefined();
		expect(again[0]).toBe(stabilised[0]);
		expect(again[1]).toBe(stabilised[1]);
	});
});
