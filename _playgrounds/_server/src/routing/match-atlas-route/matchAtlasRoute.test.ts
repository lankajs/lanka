import { describe, expect, it } from "vitest";
import { matchAtlasRoute } from "./matchAtlasRoute";
import type { IAtlasRoute } from "../../_interfaces/IAtlasRoute";

const route = (method: IAtlasRoute["method"], path: string): IAtlasRoute => ({
	method,
	path,
	run: () => undefined,
});

describe("matchAtlasRoute", () => {
	const table: readonly IAtlasRoute[] = [
		route("GET", "/missions"),
		route("GET", "/missions/legacy"),
		route("GET", "/missions/:id"),
		route("POST", "/missions"),
		route("GET", "/crew/:crewId/avatar.png"),
	];

	it("finds an exact path", () => {
		expect(matchAtlasRoute(table, "GET", "/missions")?.route.path).toBe("/missions");
	});

	it("captures a named segment", () => {
		expect(matchAtlasRoute(table, "GET", "/missions/m-7")?.params).toEqual({ id: "m-7" });
	});

	it("tells two methods on one path apart", () => {
		expect(matchAtlasRoute(table, "POST", "/missions")?.route.method).toBe("POST");
	});

	it("answers in table order, so a literal declared above a capture wins", () => {
		// The alternative is a specificity rule, and a table whose meaning depends
		// on one cannot be read top to bottom.
		expect(matchAtlasRoute(table, "GET", "/missions/legacy")?.route.path).toBe(
			"/missions/legacy",
		);
	});

	it("does not match a path of a different length", () => {
		expect(matchAtlasRoute(table, "GET", "/missions/m-7/extra")).toBeNull();
	});

	it("answers null for a path nothing declares", () => {
		expect(matchAtlasRoute(table, "GET", "/nowhere")).toBeNull();
	});

	it("decodes what the capture held", () => {
		expect(matchAtlasRoute(table, "GET", "/missions/a%20b")?.params.id).toBe("a b");
	});

	it("tells a no-capture match from no match at all", () => {
		// Both would be an empty object of captures if the two were not different
		// answers, and every request would then route to the first pattern of the
		// right length.
		expect(matchAtlasRoute(table, "GET", "/missions")?.params).toEqual({});
		expect(matchAtlasRoute(table, "GET", "/mission")).toBeNull();
	});
});
