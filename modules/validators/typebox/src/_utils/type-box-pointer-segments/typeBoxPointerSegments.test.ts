import { describe, expect, it } from "vitest";
import { typeBoxPointerSegments } from "./typeBoxPointerSegments";

/**
 * The parser, driven directly.
 *
 * Through a schema it would only ever see the pointers today's TypeBox happens
 * to produce; the escapes that break a naive `split("/")` are exactly the ones a
 * schema is awkward to arrange.
 */
describe("typeBoxPointerSegments", () => {
	it("reads a plain pointer", () => {
		expect(typeBoxPointerSegments("/user/name")).toEqual(["user", "name"]);
	});

	it("turns an index into a NUMBER, so a list position is not a key", () => {
		expect(typeBoxPointerSegments("/tags/0/id")).toEqual(["tags", 0, "id"]);
	});

	it("answers the root pointer with the ROOT rather than an empty name", () => {
		expect(typeBoxPointerSegments("")).toEqual([]);
		expect(typeBoxPointerSegments(undefined)).toEqual([]);
	});

	it("unescapes a slash in a key, which `split` would tear in two", () => {
		expect(typeBoxPointerSegments("/meta/a~1b")).toEqual(["meta", "a/b"]);
	});

	it("unescapes a tilde in a key", () => {
		expect(typeBoxPointerSegments("/meta/a~0b")).toEqual(["meta", "a~b"]);
	});

	it("unescapes in the order RFC 6901 requires, so `~01` stays `~1`", () => {
		// The reverse order turns `~01` into `/`: `~0` becomes `~`, and the `~1`
		// that was never an escape is then read as one.
		expect(typeBoxPointerSegments("/a~01")).toEqual(["a~1"]);
	});
});
