import { describe, expect, it } from "vitest";
import type { TLankaValidationResult } from "lanka/validation";

/**
 * What every validator package must do, asserted once for the whole family.
 *
 * ## Why this is not six playground tests
 *
 * `modules/validators/` holds one package per schema library, and each promises
 * the same thing: a schema written in THAT library reaches the framework's port
 * intact, and a failure comes back as something a form can put beside an input.
 * The promise is identical; only the syntax of the schema differs.
 *
 * Written by hand six times, the six copies diverge — not on the day they are
 * written, but on the day one of them gains an assertion and the other five do
 * not. The package that then stops keeping the promise has a green suite, which
 * is the second way a check reports success: it never asked the question.
 *
 * So the ASSERTIONS live here and the SCHEMAS live in each package. What a caller
 * supplies is its library's spelling of one agreed shape; what it gets back is
 * the same eight scenes, named the same way in every package's output.
 *
 * ## What a caller has to write
 *
 * Three schemas over the shape below. They are not arbitrary: a flat schema
 * cannot show that failures arrive as field PATHS, and a single schema cannot
 * show that a mapping is a schema rather than an adapter layer.
 *
 * | Schema     | Accepts                                        | Produces                                      |
 * | ---------- | ---------------------------------------------- | --------------------------------------------- |
 * | `signUp`   | `{ email: string, age: int >= 18, tags: [{ id: number }] }` | the same value                    |
 * | `apiShape` | `{ user_email: string, user_age: number, is_active: 0 \| 1 }` | `{ email, age, isActive: boolean }` |
 * | `toApi`    | `{ email: string, age: number, isActive: boolean }` | `{ user_email, user_age, is_active: 0 \| 1 }` |
 *
 * ```ts
 * describe("the zod playground", () => {
 * 	lankaValidatorConformance({
 * 		vendor: "zod",
 * 		validator: lankaZodValidator,
 * 		signUp: playgroundSignUpSchema,
 * 		apiShape: playgroundApiShapeSchema,
 * 		toApi: playgroundToApiSchema,
 * 	});
 * });
 * ```
 *
 * A package is free to add scenes of its own beside this call — the zod 3 bridge
 * and the yup synchronous path have nothing to compare against and belong in
 * their own package. This covers what they all share, and nothing else.
 */

/**
 * The validator under test, described by what this suite calls on it.
 *
 * Deliberately NOT `ILankaValidator`: two of the family's libraries do not
 * implement Standard Schema, so their validators take a schema type of their own
 * and are not assignable to the port's signature. A suite typed by the port would
 * therefore be unable to test the two packages that most need testing.
 */
export interface ILankaConformingValidator<TSchema> {
	validate(schema: TSchema, data: unknown, context: string): unknown;
	validateSafe(schema: TSchema, data: unknown): TLankaValidationResult<unknown>;
}

/** One package's entry into the family's shared assertions. */
export interface ILankaValidatorConformance<TSchema> {
	/** The library's name, as it appears in the test output. */
	vendor: string;
	validator: ILankaConformingValidator<TSchema>;
	/** The sign-up rules, in this library's syntax. */
	signUp: TSchema;
	/** The wire shape, mapped into the application's vocabulary. */
	apiShape: TSchema;
	/** The domain, mapped into the payload the backend expects back. */
	toApi: TSchema;
}

/** A submission every one of the schemas must accept. */
export const LANKA_CONFORMANCE_VALID = Object.freeze({
	email: "ada@example.com",
	age: 36,
	tags: [{ id: 1 }],
});

/** The wire a backend sends, and what the mapping must produce from it. */
export const LANKA_CONFORMANCE_WIRE = Object.freeze({
	user_email: "ada@example.test",
	user_age: 36,
	is_active: 1,
});

/**
 * Registers the family's shared scenes against one package's schemas.
 *
 * Call it inside the package's own `describe`, so the output says which vendor
 * failed without the suite having to repeat the name in every title.
 */
export const lankaValidatorConformance = <TSchema>({
	vendor,
	validator,
	signUp,
	apiShape,
	toApi,
}: ILankaValidatorConformance<TSchema>): void => {
	const asFailure = (result: TLankaValidationResult<unknown>) => {
		if (result.success) throw new Error(`${vendor}: expected a refusal, got a value`);
		return result;
	};

	describe(`${vendor}, as a form uses it`, () => {
		it("accepts a valid submission and returns the parsed value", () => {
			const result = validator.validateSafe(signUp, LANKA_CONFORMANCE_VALID);

			expect(result.success).toBe(true);
			if (result.success) expect(result.data).toMatchObject({ email: "ada@example.com" });
		});

		it("refuses an invalid submission without throwing", () => {
			const result = validator.validateSafe(signUp, { ...LANKA_CONFORMANCE_VALID, age: 15 });

			expect(result.success).toBe(false);
		});

		it("reports the field PATH, so a message can reach its input", () => {
			const result = asFailure(
				validator.validateSafe(signUp, {
					...LANKA_CONFORMANCE_VALID,
					tags: [{ id: "one" }],
				}),
			);

			// Joined, because that is what a banner shows. The segments are asserted
			// separately below: a form cannot parse an address back out of a string.
			expect(result.errors.join(" ")).toContain("tags.0.id");
		});

		it("keeps the path in SEGMENTS as well, with the index a number", () => {
			const result = asFailure(
				validator.validateSafe(signUp, {
					...LANKA_CONFORMANCE_VALID,
					tags: [{ id: "one" }],
				}),
			);

			// `fields` is optional on the port, so a package may answer without it —
			// but if it answers, the address has to be an address.
			const field = result.fields?.find((f) => f.path.includes("tags"));

			expect(field, `${vendor} reports no field segments for tags.0.id`).toBeDefined();
			expect(field?.path).toEqual(["tags", 0, "id"]);
		});

		it("reports every failing field, not only the first", () => {
			const result = asFailure(
				validator.validateSafe(signUp, { email: "not-an-email", age: 15, tags: [] }),
			);

			expect(result.errors.length).toBeGreaterThan(1);
		});

		it("throws on the strict path, naming the context", () => {
			expect(() =>
				validator.validate(signUp, { ...LANKA_CONFORMANCE_VALID, age: 15 }, "sign-up"),
			).toThrow(/sign-up/);
		});
	});

	describe(`${vendor}, at the edges`, () => {
		/*
		 * The values a schema is never written for, and a body arrives as anyway.
		 *
		 * A gateway hands the port whatever the wire produced: `null` from a 204
		 * parsed as JSON, a bare array where an object was promised, a string where
		 * the endpoint returned an error page. None of them may crash, and none of
		 * them may pass — a validator that throws a TypeError on `null` has turned
		 * a bad response into a bug report about the framework.
		 */
		const hostile: [string, unknown][] = [
			["null", null],
			["undefined", undefined],
			["a bare array", []],
			["a string", "not an object"],
			["a number", 42],
			["a boolean", true],
			["an empty object", {}],
			["an object with a null prototype", Object.create(null) as unknown],
		];

		for (const [name, value] of hostile) {
			it(`refuses ${name} without throwing`, () => {
				const result = validator.validateSafe(signUp, value);

				expect(result.success).toBe(false);
			});
		}

		/*
		 * A value whose GETTER throws is deliberately not a scene here.
		 *
		 * It looks like the natural next hostile input, and it tests the wrong thing:
		 * zod turns a synchronous throw raised from inside the value into a rejected
		 * promise, which surfaces as an unhandled rejection and fails the run for
		 * reasons that are the library's plumbing rather than this family's promise.
		 * The eight inputs above already establish that the value is READ; a
		 * pathological getter only establishes how each library reports its own
		 * surprise.
		 */

		it("refuses extra deep nesting with a path that still addresses the field", () => {
			const result = validator.validateSafe(signUp, {
				...LANKA_CONFORMANCE_VALID,
				tags: [{ id: 1 }, { id: 2 }, { id: "three" }],
			});

			expect(result.success).toBe(false);
			if (!result.success) {
				// The THIRD element, not the first: an index that does not travel
				// points the message at the wrong input, which is worse than no
				// message at all.
				expect(result.errors.join(" ")).toContain("tags.2.id");
			}
		});

		it("reads an empty list as valid, since 'no tags' is not 'a broken tag'", () => {
			const result = validator.validateSafe(signUp, { ...LANKA_CONFORMANCE_VALID, tags: [] });

			expect(result.success).toBe(true);
		});

		it("holds the boundary exactly: 18 passes, 17 does not", () => {
			// An off-by-one in a rule every package spells differently is exactly the
			// difference a shared suite exists to catch.
			expect(
				validator.validateSafe(signUp, { ...LANKA_CONFORMANCE_VALID, age: 18 }).success,
			).toBe(true);
			expect(
				validator.validateSafe(signUp, { ...LANKA_CONFORMANCE_VALID, age: 17 }).success,
			).toBe(false);
		});

		it("refuses a non-integer age, which a slider produces and a form does not show", () => {
			expect(
				validator.validateSafe(signUp, { ...LANKA_CONFORMANCE_VALID, age: 18.5 }).success,
			).toBe(false);
		});

		it("refuses NaN and Infinity, which JSON cannot carry but a computed value can", () => {
			expect(
				validator.validateSafe(signUp, { ...LANKA_CONFORMANCE_VALID, age: NaN }).success,
			).toBe(false);
			expect(
				validator.validateSafe(signUp, { ...LANKA_CONFORMANCE_VALID, age: Infinity })
					.success,
			).toBe(false);
		});

		it("does not mutate the value it was given", () => {
			// A validator that strips or coerces in place changes what the caller
			// still holds a reference to, and the bug surfaces two layers away.
			const input = { ...LANKA_CONFORMANCE_VALID, tags: [{ id: 1 }] };
			const before = JSON.stringify(input);

			validator.validateSafe(signUp, input);

			expect(JSON.stringify(input)).toBe(before);
		});

		it("answers the same way twice, so nothing is cached against the VALUE", () => {
			// Every package in the family caches something — a compiled checker, a
			// wrapper — and a cache keyed by anything but the schema would make the
			// second answer depend on the first.
			const bad = { ...LANKA_CONFORMANCE_VALID, age: 15 };

			expect(validator.validateSafe(signUp, bad).success).toBe(false);
			expect(validator.validateSafe(signUp, LANKA_CONFORMANCE_VALID).success).toBe(true);
			expect(validator.validateSafe(signUp, bad).success).toBe(false);
		});

		it("survives a value that is deep, without a stack overflow", () => {
			// A cyclic structure is the honest version of this, but JSON cannot carry
			// one; depth is what a real body reaches. A validator recursing without a
			// guard fails here rather than in production.
			let deep: Record<string, unknown> = { id: 1 };
			for (let index = 0; index < 200; index += 1) deep = { nested: deep };

			expect(
				validator.validateSafe(signUp, { ...LANKA_CONFORMANCE_VALID, extra: deep }).success,
			).toBe(true);
		});
	});

	describe(`${vendor}, reading a backend that speaks another shape`, () => {
		it("maps the wire into the application's vocabulary in one call", () => {
			// No adapter layer: the mapping travelled in the schema, and validate
			// returns what the schema produced.
			expect(validator.validate(apiShape, LANKA_CONFORMANCE_WIRE, "user.map")).toEqual({
				email: "ada@example.test",
				age: 36,
				isActive: true,
			});
		});

		it("maps back into the payload that backend expects", () => {
			expect(
				validator.validate(
					toApi,
					{ email: "ada@example.test", age: 36, isActive: false },
					"user.toApi",
				),
			).toEqual({ user_email: "ada@example.test", user_age: 36, is_active: 0 });
		});

		it("refuses a wire the mapping cannot read, naming which contract broke", () => {
			// The context names the MAPPING rather than the domain check: which of
			// the two contracts broke is the difference between calling the backend
			// team and reading your own reducer.
			expect(() =>
				validator.validate(apiShape, { user_email: "ada@example.test" }, "user.map"),
			).toThrow(/user\.map/);
		});
	});
};
