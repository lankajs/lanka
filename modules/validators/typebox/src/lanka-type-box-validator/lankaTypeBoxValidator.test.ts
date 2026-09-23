import { describe, expect, it } from "vitest";
import { Type } from "typebox";
import { lankaTypeBoxValidator } from "./lankaTypeBoxValidator";

/**
 * The bridge, and the defect it exists for.
 *
 * The family's shared scenes are in `_playground/`, through the conformance
 * suite. What is here is TypeBox-specific and has no counterpart to compare
 * with: the missing Standard Schema, JSON Pointer paths, the codec pass and the
 * compiled checker's cache.
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

	it("applies a codec, so a mapping is a schema rather than a layer", () => {
		const lengthOf = Type.Codec(Type.String())
			.Decode((text) => text.length)
			.Encode((length) => "x".repeat(length));

		expect(lankaTypeBoxValidator.validate(lengthOf, "abcd", "length")).toBe(4);
	});

	it("refuses a codec's input before the decode function ever runs", () => {
		const lengthOf = Type.Codec(Type.String())
			.Decode((text) => text.length)
			.Encode((length) => "x".repeat(length));

		const result = lankaTypeBoxValidator.validateSafe(lengthOf, 5);

		expect(result.success).toBe(false);
	});

	it("turns a throwing decode function into a refusal rather than a crash", () => {
		// A decode function is consumer code. `validateSafe` promises to throw
		// nothing, so a date that does not parse is a refused body, not an
		// exception escaping the validator.
		const refuses = Type.Codec(Type.String())
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
		const rude = Type.Codec(Type.String())
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

	it.each([undefined, null, { code: 7 }])(
		"still says something when a decode throws %s",
		(thrown) => {
			// TypeBox 1.x rethrows whatever the decode function threw, unwrapped, so for
			// these there is nothing to read a message from — and `String(thrown)`
			// would put "undefined" or "[object Object]" in front of a user.
			const rude = Type.Codec(Type.String())
				.Decode(() => {
					// where there is no original to recover, which is what the test pins.
					// eslint-disable-next-line @typescript-eslint/only-throw-error -- the point of the test
					throw thrown;
				})
				.Encode((value: unknown) => String(value));

			const result = lankaTypeBoxValidator.validateSafe(rude, "x");

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.errors[0]).toMatch(/decode function refused/);
				expect(result.errors[0]).not.toMatch(/undefined|null|object Object/);
			}
		},
	);

	it("decodes a copy, leaving the caller's body as it arrived", () => {
		// TypeBox 1.x's decode-only pass writes the decoded values back into the
		// object it is given. The body is the caller's; a validator that rewrites it
		// in place is a side effect nobody asked for.
		const schema = Type.Object({
			n: Type.Codec(Type.String())
				.Decode((text) => text.length)
				.Encode((length: number) => "x".repeat(length)),
		});
		const body = { n: "abcd" };

		expect(lankaTypeBoxValidator.validate(schema, body, "body")).toEqual({ n: 4 });
		expect(body).toEqual({ n: "abcd" });
	});

	it("keeps what the schema did not name, whether or not the schema has a codec", () => {
		// TypeBox 1.x's full `Decode` also CLEANS — drops every property the schema
		// did not name — and the path without a codec returns the body untouched.
		// One validator answering two ways depending on whether a codec sits
		// somewhere inside the schema would be a difference nobody could predict.
		const plain = Type.Object({ n: Type.String() });
		const withCodec = Type.Object({
			n: Type.Codec(Type.String())
				.Decode((text) => text.length)
				.Encode((length: number) => "x".repeat(length)),
		});

		expect(lankaTypeBoxValidator.validate(plain, { n: "ab", extra: 1 }, "x")).toEqual({
			n: "ab",
			extra: 1,
		});
		expect(lankaTypeBoxValidator.validate(withCodec, { n: "ab", extra: 1 }, "x")).toEqual({
			n: 2,
			extra: 1,
		});
	});

	it("refuses a plain JSON Schema: TypeBox 1.x takes one, this package does not", () => {
		// `IsSchema` answers true for ANY object, since any object is a JSON Schema,
		// so a zod schema would compile to "accept everything". `~kind` is the mark
		// TypeBox's builders set, and it is what the guard reads.
		// No cast: TypeBox 1.x's own types accept a JSON Schema, so only the guard
		// stands between this call and a checker.
		expect(() => lankaTypeBoxValidator.validateSafe({ type: "string" }, "x")).toThrowError(
			/not a TypeBox schema/i,
		);
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
		// Before this, TypeBox 0.34's compiler threw `TypeCompilerTypeGuardError:
		// Preflight validation check failed` — accurate, and useless to anyone who
		// has not read TypeBox's source. TypeBox 1.x would say nothing at all: it
		// compiles any object, and one without a `type` accepts everything.
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
