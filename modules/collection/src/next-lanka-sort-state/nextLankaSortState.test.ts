import { describe, expect, it } from "vitest";
import { nextLankaSortState } from "./nextLankaSortState";

const off = { field: null, order: null } as const;

describe("what a header click does", () => {
	it("sorts ascending on a column nobody was sorting by", () => {
		expect(nextLankaSortState(off, "name")).toEqual({ field: "name", order: "asc" });
	});

	it("turns ascending into descending", () => {
		expect(nextLankaSortState({ field: "name", order: "asc" }, "name")).toEqual({
			field: "name",
			order: "desc",
		});
	});

	it("turns descending OFF, which is the only way back to the server's order", () => {
		expect(nextLankaSortState({ field: "name", order: "desc" }, "name")).toEqual(off);
	});

	it("starts over on a different column", () => {
		expect(nextLankaSortState({ field: "name", order: "desc" }, "created")).toEqual({
			field: "created",
			order: "asc",
		});
	});

	it("does not mutate the state it was given", () => {
		const current = { field: "name", order: "asc" } as const;

		nextLankaSortState(current, "name");

		expect(current).toEqual({ field: "name", order: "asc" });
	});
});
