import { beforeEach, describe, expect, it } from "vitest";
import { createPlaygroundEmployeeList, createPlaygroundEmployees } from "./app";

/**
 * The package, driven the way a table screen drives it.
 *
 * Its unit tests prove each operation behaves. These prove the property the
 * package exists for, which no single operation can show: a screen that is
 * searched, sorted, paged and refetched keeps handing React the same arrays and
 * the same row objects until something it renders actually changed.
 */
let list: ReturnType<typeof createPlaygroundEmployeeList>;

beforeEach(() => {
	list = createPlaygroundEmployeeList();
	list.receive(createPlaygroundEmployees());
});

describe("a table screen", () => {
	it("shows one page of everything before anyone touches it", () => {
		expect(list.visible.items).toHaveLength(2);
		expect(list.visible.totalPages).toBe(2);
	});

	it("renders the same thing twice when nothing happened between", () => {
		// The single most valuable assertion in this package: a render that
		// changed nothing produces the identical array, so no row below it
		// re-renders.
		expect(list.visible.items).toBe(list.visible.items);
	});

	it("sorts by a header click, and cycles it off on the third", () => {
		list.clickHeader("name");
		expect(list.visible.items.map((row) => row.name)).toEqual(["Ada", "Alan"]);

		list.clickHeader("name");
		expect(list.visible.items.map((row) => row.name)).toEqual(["Grace", "Alan"]);

		list.clickHeader("name");
		expect(list.sortState).toEqual({ field: null, order: null });
	});

	it("sorts by a nested field, because reading one is the application's job", () => {
		list.clickHeader("role");

		expect(list.visible.items.map((row) => row.role.name)).toEqual(["admin", "admin"]);
	});

	it("searches, and puts the reader back on the first page", () => {
		list.goToPage(2);
		list.search("a");

		expect(list.visible.items.map((row) => row.name)).toEqual(["Ada", "Grace"]);
		expect(list.visible.totalPages).toBe(2);
	});

	it("keeps every row object when the server answered the same thing again", () => {
		const before = list.visible.items;

		list.receive(createPlaygroundEmployees());

		// Fresh objects went in — this is what a poll every thirty seconds looks
		// like — and the screen got its own back.
		expect(list.visible.items).toBe(before);
	});

	it("replaces only the row that actually changed", () => {
		const before = list.visible.items;
		const next = createPlaygroundEmployees();
		next[1] = { ...next[1], name: "Grace H." };

		list.receive(next);

		expect(list.visible.items[0]).toBe(before[0]);
		expect(list.visible.items[1]).not.toBe(before[1]);
	});

	it("survives a page beyond the end without pretending it has rows", () => {
		list.goToPage(99);

		expect(list.visible.items).toEqual([]);
		expect(list.visible.totalPages).toBe(2);
	});
});

describe("an operator the package did not ship", () => {
	it("filters by a date the way this screen means it", () => {
		list.hiredBefore(new Date("2021-01-01"));

		// The package orders dates correctly and compares them as text — every
		// application needs one of these, and none of them is the same. Replacing
		// one entry is the whole cost.
		expect(list.visible.items.map((row) => row.name)).toEqual(["Ada", "Alan"]);
	});

	it("leaves the other ten alone", () => {
		list.search("grace");

		expect(list.visible.items.map((row) => row.name)).toEqual(["Grace"]);
	});
});
