import { describe, expect, it } from "vitest";
import { createLankaPaginator } from "./createLankaPaginator";

const rows = [1, 2, 3, 4, 5];

describe("taking one page", () => {
	it("gives the page that was asked for", () => {
		const paginate = createLankaPaginator<number>();

		expect(paginate(rows, 2, 2).items).toEqual([3, 4]);
	});

	it("counts the pages, and never fewer than one", () => {
		const paginate = createLankaPaginator<number>();

		expect(paginate(rows, 1, 2).totalPages).toBe(3);
		expect(paginate([], 1, 10).totalPages).toBe(1);
	});

	it("answers with the SAME array when a page covers the whole list", () => {
		const paginate = createLankaPaginator<number>();

		// The commonest table has fewer rows than its page size, and slicing would
		// hand React a new array on every keystroke elsewhere.
		expect(paginate(rows, 1, 50).items).toBe(rows);
	});

	it("repeats its previous answer for the same arguments", () => {
		const paginate = createLankaPaginator<number>();

		expect(paginate(rows, 2, 2)).toBe(paginate(rows, 2, 2));
	});

	it("survives a page size of zero rather than dividing by it", () => {
		const paginate = createLankaPaginator<number>();

		expect(paginate(rows, 1, 0).totalPages).toBe(5);
	});
});
