import { describe, expect, it } from "vitest";
import * as yup from "yup";
import { lankaStandardValidator } from "lanka/validation";
import { lankaYupValidator } from "./lankaYupValidator";

/**
 * The bridge, and the defect it exists for.
 *
 * The family's shared scenes are in `_playground/`, through the conformance
 * suite. What is here is yup-specific and has no counterpart to compare with:
 * the asynchronous Standard Schema, yup's bracketed paths, its path-less
 * top-level failure, and the test that cannot run synchronously.
 */
describe("why the package exists", () => {
	const user = yup.object({ id: yup.number().required() });

	it("yup's own Standard Schema is asynchronous, for a valid value too", () => {
		// The whole reason for the bridge, pinned rather than described: if yup ever
		// ships a synchronous `~standard`, this test fails and the package becomes
		// an alias like the rest of the family.
		const answer = user["~standard"].validate({ id: 1 });

		expect(answer).toBeInstanceOf(Promise);
	});

	it("core's port therefore refuses every yup schema", () => {
		expect(() =>
			lankaStandardValidator.validate(
				user as unknown as Parameters<typeof lankaStandardValidator.validate>[0],
				{ id: 1 },
				"user",
			),
		).toThrowError(/asynchronous/i);
	});

	it("and this validator accepts the same schema", () => {
		expect(lankaYupValidator.validate(user, { id: 1 }, "user")).toEqual({ id: 1 });
	});
});

describe("lankaYupValidator", () => {
	const signUp = yup.object({
		email: yup.string().email().required(),
		age: yup.number().integer().min(18).required(),
		tags: yup.array(yup.object({ id: yup.number().required() })).required(),
	});

	it("returns the CAST value, which is what the schema produced", () => {
		// yup casts before it checks, so a numeric string arrives as a number. The
		// port promises what the schema produced, not what the caller passed.
		const parsed = lankaYupValidator.validate(
			yup.object({ age: yup.number().required() }),
			{ age: "36" },
			"user",
		);

		expect(parsed).toEqual({ age: 36 });
	});

	it("translates yup's bracketed path into segments", () => {
		const result = lankaYupValidator.validateSafe(signUp, {
			email: "ada@example.com",
			age: 36,
			tags: [{ id: "one" }],
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			// yup says `tags[0].id`; a form reads segments, and the index is a number.
			expect(result.fields?.[0].path).toEqual(["tags", 0, "id"]);
			expect(result.errors[0]).toContain("tags.0.id");
		}
	});

	it("reports every failing field rather than the first", () => {
		const result = lankaYupValidator.validateSafe(signUp, {
			email: "not-an-email",
			age: 15,
			tags: [],
		});

		expect(result.success).toBe(false);
		if (!result.success) expect(result.errors.length).toBeGreaterThan(1);
	});

	it("gives a top-level refusal an EMPTY path — the form's root, not an input", () => {
		// `yup.number().min(18)` refusing a bare 3 reports `path: undefined`. An
		// input named "" is not a place; the root is.
		const result = lankaYupValidator.validateSafe(yup.number().min(18), 3);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.fields?.[0].path).toEqual([]);
			expect(result.errors[0]).not.toContain(":");
		}
	});

	it("throws with the label in the message, on the strict path", () => {
		expect(() => lankaYupValidator.validate(signUp, { age: 15 }, "sign-up")).toThrowError(
			/sign-up/,
		);
	});

	it("refuses a schema whose test cannot run synchronously, in the port's words", () => {
		const asyncSchema = yup.string().test("slow", "nope", () => Promise.resolve(true));

		// yup throws a plain Error about "a Promise during a synchronous validate".
		// A consumer should see the port's refusal, which says what to do about it.
		expect(() => lankaYupValidator.validate(asyncSchema, "x", "slow")).toThrowError(
			/could not validate this synchronously/i,
		);
	});

	it("carries what yup said, so the rule can be found", () => {
		const asyncSchema = yup.string().test("slow", "nope", () => Promise.resolve(true));

		expect(() => lankaYupValidator.validate(asyncSchema, "x", "slow")).toThrowError(/Promise/i);
	});

	it("survives consumer code throwing something that is not an Error", () => {
		// A `test` or a `transform` is the application's own code and may throw
		// anything. Reading `.message` off a string yields `undefined`, and a refusal
		// whose message is "undefined" is a refusal nobody can act on.
		const rude = yup.string().test("rude", "m", () => {
			// non-Error is exactly what is under test: a `test` is consumer code.
			// eslint-disable-next-line @typescript-eslint/only-throw-error -- the point of the test
			throw "a bare string";
		});

		expect(() => lankaYupValidator.validate(rude, "x", "rude")).toThrowError(/a bare string/);
	});

	it("reports a transform that refuses, whose `inner` yup leaves EMPTY", () => {
		// Not exotic: the mapping schemas this family recommends are transforms, and
		// a transform throwing a ValidationError is how one says "this wire is not
		// the shape I map". Reading `inner` alone would report a failure with no
		// message at all.
		const mapping = yup.string().transform(() => {
			throw new yup.ValidationError("that wire is not mine");
		});

		const result = lankaYupValidator.validateSafe(mapping, "anything");

		expect(result.success).toBe(false);
		if (!result.success) expect(result.errors).toEqual(["that wire is not mine"]);
	});

	it("is frozen, because a table of behaviour must not be reachable into", () => {
		expect(Object.isFrozen(lankaYupValidator)).toBe(true);
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
		lankaYupValidator.validateSafe(
			schema as Parameters<typeof lankaYupValidator.validateSafe>[0],
			{},
		);

	it("is refused by name, rather than dying on `validateSync`", () => {
		// Before the guard this read `validateSync` off a zod schema and threw a raw
		// TypeError out of `validateSafe` — a method that promises to throw nothing
		// the data caused.
		expect(() => refuse(standardLike)).toThrowError(/not a yup schema/i);
	});

	it("is told that its own dialect has a package, when it carries `~standard`", () => {
		expect(() => refuse(standardLike)).toThrowError(/~standard/);
	});

	it("reads a CALLABLE schema too, which is what arktype hands it", () => {
		// arktype's schema is a function, not an object. A hint that only inspects
		// objects would tell an arktype user "not a schema at all".
		expect(() => refuse(Object.assign((value: unknown) => value, standardLike))).toThrowError(
			/~standard/,
		);
	});

	it("is told something else when it is not a schema at all", () => {
		// Two different mistakes: a schema from the wrong library is a routing
		// error, and a plain object is a bug in the calling code.
		expect(() => refuse({ nope: true })).toThrowError(/not a schema at all/i);
		expect(() => refuse(null)).toThrowError(/not a yup schema/i);
		expect(() => refuse(42)).toThrowError(/not a yup schema/i);
	});
});
