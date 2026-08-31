import { describe, expect, it } from "vitest";
import { lankaZodValidator } from "../src/index";
import { createPlaygroundForm, playgroundApiShapeSchema, playgroundToApiSchema } from "./app";

/**
 * The package, used as a form uses it.
 *
 * What matters is not that zod validates — zod's own tests cover that — but that
 * a zod schema passes through the framework's validator port intact, and that a
 * failure arrives as something a form can put next to an input.
 */
const valid = { email: "ada@example.com", age: 36, tags: [{ id: 1 }] };

describe("the zod playground", () => {
	it("accepts a valid submission and keeps the parsed value", () => {
		const form = createPlaygroundForm();

		expect(form.submit(valid)).toBe(true);
		expect(form.state.value?.email).toBe("ada@example.com");
		expect(form.state.fieldErrors).toEqual([]);
	});

	it("refuses an invalid submission without throwing", () => {
		const form = createPlaygroundForm();

		expect(form.submit({ ...valid, age: 15 })).toBe(false);
		expect(form.state.value).toBeNull();
	});

	it("reports the field PATH, so a message can reach its input", () => {
		const form = createPlaygroundForm();

		form.submit({ ...valid, tags: [{ id: "one" }] });

		expect(form.state.fieldErrors.join(" ")).toContain("tags.0.id");
	});

	it("reports every failing field, not only the first", () => {
		const form = createPlaygroundForm();

		form.submit({ email: "not-an-email", age: 15, tags: [] });

		expect(form.state.fieldErrors.length).toBeGreaterThan(1);
	});

	it("clears previous errors once a submission succeeds", () => {
		const form = createPlaygroundForm();

		form.submit({ ...valid, age: 15 });
		form.submit(valid);

		expect(form.state.fieldErrors).toEqual([]);
	});

	it("throws on the strict path, naming the context", () => {
		const form = createPlaygroundForm();

		expect(() => form.parseOrThrow({ ...valid, age: 15 })).toThrow(/playground sign-up/);
	});
});

describe("a backend that speaks another shape", () => {
	it("maps the wire into the application's vocabulary in one call", () => {
		const domain = lankaZodValidator.validate(
			playgroundApiShapeSchema,
			{ user_email: "ada@example.test", user_age: 36, is_active: 1 },
			"user.map",
		);

		// No adapter layer: the mapping travelled in the schema, and validate
		// returns what it produced.
		expect(domain).toEqual({ email: "ada@example.test", age: 36, isActive: true });
	});

	it("maps back into the payload that backend expects", () => {
		const payload = lankaZodValidator.validate(
			playgroundToApiSchema,
			{ email: "ada@example.test", age: 36, isActive: false },
			"user.toApi",
		);

		expect(payload).toEqual({ user_email: "ada@example.test", user_age: 36, is_active: 0 });
	});

	it("refuses a wire the mapping cannot read, naming which contract broke", () => {
		const result = lankaZodValidator.validateSafe(playgroundApiShapeSchema, {
			user_email: "ada@example.test",
		});

		// The context names the MAPPING rather than the domain check: which of the
		// two contracts broke is the difference between calling the backend team
		// and reading your own reducer.
		expect(result.success).toBe(false);
	});
});
