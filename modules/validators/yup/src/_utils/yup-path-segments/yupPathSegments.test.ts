import { describe, expect, it } from "vitest";
import { yupPathSegments } from "./yupPathSegments";

/**
 * The parser, driven directly.
 *
 * Through a schema it would only ever see the paths today's yup happens to
 * produce; the cases that break a naive `split(".")` are exactly the ones a
 * schema is awkward to arrange.
 */
describe("yupPathSegments", () => {
	it("splits a plain path", () => {
		expect(yupPathSegments("user.name")).toEqual(["user", "name"]);
	});

	it("turns an index into a NUMBER, so a list position is not a key", () => {
		expect(yupPathSegments("tags[0].id")).toEqual(["tags", 0, "id"]);
	});

	it("reads consecutive indexes", () => {
		expect(yupPathSegments("grid[2][3]")).toEqual(["grid", 2, 3]);
	});

	it("keeps a bracketed key whole, dots and all", () => {
		// The case `split(".")` gets wrong: one field would become two that address
		// nothing, and the message would land on neither.
		expect(yupPathSegments('meta["a.b"]')).toEqual(["meta", "a.b"]);
	});

	it("reads a single-quoted key too, since yup writes both", () => {
		expect(yupPathSegments("meta['a.b']")).toEqual(["meta", "a.b"]);
	});

	it("answers an absent path with the ROOT rather than an empty name", () => {
		expect(yupPathSegments(undefined)).toEqual([]);
		expect(yupPathSegments("")).toEqual([]);
	});
});
