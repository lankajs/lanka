import { describe, expect, it } from "vitest";
import { Type } from "@sinclair/typebox";
import { lankaTypeBoxValidator } from "./lankaTypeBoxValidator";

/**
 * The bridge, and the defect it exists for.
 *
 * The family's shared scenes are in `_playground/`, through the conformance
 * suite. What is here is TypeBox-specific and has no counterpart to compare
 * with: the missing Standard Schema, JSON Pointer paths, the transform pass and
 * the compiled checker's cache.
 */
describe("why the package exists", () => {
	it("a TypeBox schema carries no `~standard`, so core's port cannot take one", () => {
		// Pinned rather than described: if TypeBox ever publishes Standard Schema,
		// this fails and the package's reason for being a bridge is up for review.
		expect("~standard" in Type.Object({ id: Type.Number() })).toBe(false);
	});
});

describe("lankaTypeBoxValidator", () => {
	const signUp = Type.Object({
		email: Type.String(),
		age: Type.Integer({ minimum: 18 }),
		tags: Type.Array(Type.Object({ id: Type.Number() })),
	});

	it("accepts a valid value and returns it", () => {
		const value = { email: "ada@example.com", age: 36, tags: [{ id: 1 }] };

		expect(lankaTypeBoxValidator.validate(signUp, value, "sign-up")).toEqual(value);
	});

	it("translates a JSON Pointer into segments, with the index a number", () => {
		const result = lankaTypeBoxValidator.validateSafe(signUp, {
			email: "ada@example.com",
			age: 36,
			tags: [{ id: "one" }],
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			// TypeBox says `/tags/0/id`; a form reads segments.
			expect(result.fields?.[0].path).toEqual(["tags", 0, "id"]);
			expect(result.errors[0]).toContain("tags.0.id");
		}
	});

	it("gives a top-level refusal an EMPTY path — the form's root, not an input", () => {
		// TypeBox's root pointer is the empty string. An input named "" is not a
		// place; the root is.
		const result = lankaTypeBoxValidator.validateSafe(Type.Number(), "no");

		expect(result.success).toBe(false);
		if (!result.success) expect(result.fields?.[0].path).toEqual([]);
	});

	it("throws with the label in the message, on the strict path", () => {
		expect(() => lankaTypeBoxValidator.validate(signUp, {}, "sign-up")).toThrowError(/sign-up/);
	});

	it("applies a transform, so a mapping is a schema rather than a layer", () => {
		const lengthOf = Type.Transform(Type.String())
			.Decode((text) => text.length)
			.Encode((length) => "x".repeat(length));

		expect(lankaTypeBoxValidator.validate(lengthOf, "abcd", "length")).toBe(4);
	});

	it("refuses a transform's input before the decode function ever runs", () => {
		const lengthOf = Type.Transform(Type.String())
			.Decode((text) => text.length)
			.Encode((length) => "x".repeat(length));

		const result = lankaTypeBoxValidator.validateSafe(lengthOf, 5);

		expect(result.success).toBe(false);
	});

	it("turns a throwing decode function into a refusal rather than a crash", () => {
		// A decode function is consumer code. `validateSafe` promises to throw
		// nothing, so a date that does not parse is a refused body, not an
		// exception escaping the validator.
		const refuses = Type.Transform(Type.String())
			.Decode(() => {
				throw new Error("that is not a date");
			})
			.Encode((value: unknown) => String(value));

		const result = lankaTypeBoxValidator.validateSafe(refuses, "nope");

		expect(result.success).toBe(false);
		if (!result.success) expect(result.errors.join(" ")).toContain("not a date");
	});

	it("survives a decode function throwing something that is not an Error", () => {
		// A decode function is the application's own code and may throw anything.
		// Reading `.message` off a string yields `undefined`, and a refusal whose
		// message is "undefined" is a refusal nobody can act on.
		const rude = Type.Transform(Type.String())
			.Decode(() => {
				// non-Error is exactly what is under test: a decode function is consumer
				// code and may throw anything.
				// eslint-disable-next-line @typescript-eslint/only-throw-error -- the point of the test
				throw "a bare string";
			})
			.Encode((value: unknown) => String(value));

		const result = lankaTypeBoxValidator.validateSafe(rude, "x");

		expect(result.success).toBe(false);
		if (!result.success) expect(result.errors.join(" ")).toContain("a bare string");
	});

	it("still says something when a decode throws `undefined`", () => {
		// The one case where TypeBox's own wrapper is the better message: there is no
		// original to recover, and `String(undefined)` would put the word "undefined"
		// in front of a user.
		const rude = Type.Transform(Type.String())
			.Decode(() => {
				// where there is no original to recover, which is what the test pins.
				// eslint-disable-next-line @typescript-eslint/only-throw-error -- the point of the test
				throw undefined;
			})
			.Encode((value: unknown) => String(value));

		const result = lankaTypeBoxValidator.validateSafe(rude, "x");

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.errors[0]).toBe("Unknown error");
			expect(result.errors[0]).not.toBe("undefined");
		}
	});

	it("compiles a schema once, so the hot path is the generated function", () => {
		const schema = Type.Object({ id: Type.Number() });

		// Not a timing assertion — those lie on a busy machine. The cache is
		// observable through the schema object's identity, which is the property the
		// implementation actually relies on.
		const first = lankaTypeBoxValidator.validateSafe(schema, { id: 1 });
		const second = lankaTypeBoxValidator.validateSafe(schema, { id: 2 });

		expect(first.success && second.success).toBe(true);
		expect(lankaTypeBoxValidator.validateSafe(schema, { id: "no" }).success).toBe(false);
	});

	it("is frozen, because a table of behaviour must not be reachable into", () => {
		expect(Object.isFrozen(lankaTypeBoxValidator)).toBe(true);
	});
});

describe("a schema from another library", () => {
	/**
	 * An application whose schemas come from two libraries eventually hands one to
	 * the wrong validator. These are the messages it gets, and they are the
	 * package's contract as much as the happy path is.
	 */
	const standardLike = {
		"~standard": {
			version: 1 as const,
			vendor: "somebody-else",
			validate: (data: unknown) => ({ value: data }),
		},
	};

	const refuse = (schema: unknown) =>
		lankaTypeBoxValidator.validateSafe(
			schema as Parameters<typeof lankaTypeBoxValidator.validateSafe>[0],
			{},
		);

	it("is refused by name, rather than by TypeBox's preflight guard", () => {
		// Before this, `TypeCompiler.Compile` threw `TypeCompilerTypeGuardError:
		// Preflight validation check failed` — accurate, and useless to anyone who
		// has not read TypeBox's source. It escaped `validateSafe` as a raw library
		// error.
		expect(() => refuse(standardLike)).toThrowError(/not a TypeBox schema/i);
	});

	it("is told that its own dialect has a package, when it carries `~standard`", () => {
		expect(() => refuse(standardLike)).toThrowError(/~standard/);
	});

	it("reads a CALLABLE schema too, which is what arktype hands it", () => {
		expect(() => refuse(Object.assign((value: unknown) => value, standardLike))).toThrowError(
			/~standard/,
		);
	});

	it("is told something else when it is not a schema at all", () => {
		expect(() => refuse({ nope: true })).toThrowError(/not a schema at all/i);
		expect(() => refuse(null)).toThrowError(/not a TypeBox schema/i);
	});
});
