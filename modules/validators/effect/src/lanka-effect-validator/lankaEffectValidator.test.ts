import { describe, expect, it } from "vitest";
import { Schema } from "effect";
import { lankaEffectValidator } from "./lankaEffectValidator";

/**
 * The package's shape matches the rest of `modules/validators/` and is asserted
 * with the same set of assertions. The scenes a form drives are in
 * `_playground/`, through the shared conformance suite.
 */
describe("lankaEffectValidator", () => {
	const signUp = Schema.Struct({
		email: Schema.String,
		age: Schema.Number,
		tags: Schema.Array(Schema.Struct({ id: Schema.Number })),
	});

	it("accepts an Effect schema, which core's port cannot be handed directly", () => {
		// The schema itself is not a Standard Schema — the wrapper is. Pinned, so
		// that a day when Effect changes this is a failing test rather than a
		// package nobody re-examined.
		expect("~standard" in signUp).toBe(false);

		const value = { email: "ada@example.com", age: 36, tags: [{ id: 1 }] };

		expect(lankaEffectValidator.validate(signUp, value, "sign-up")).toEqual(value);
	});

	it("reports the field path", () => {
		const result = lankaEffectValidator.validateSafe(signUp, {
			email: "ada@example.com",
			age: 36,
			tags: [{ id: "one" }],
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.fields?.[0].path).toEqual(["tags", 0, "id"]);
			expect(result.errors.join(" ")).toContain("tags.0.id");
		}
	});

	it("throws with the label in the message, on the strict path", () => {
		expect(() => lankaEffectValidator.validate(signUp, {}, "sign-up")).toThrowError(/sign-up/);
	});

	it("is frozen, because a table of behaviour must not be reachable into", () => {
		expect(Object.isFrozen(lankaEffectValidator)).toBe(true);
	});
});
