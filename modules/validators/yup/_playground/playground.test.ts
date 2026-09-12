import { describe, expect, it } from "vitest";
import { lankaValidatorConformance } from "@lankajs/tool-testing/lankaValidatorConformance";
import { lankaYupValidator } from "../src/index";
import {
	createPlaygroundForm,
	playgroundApiShapeSchema,
	playgroundSignUpSchema,
	playgroundToApiSchema,
} from "./app";

/**
 * The package, used as a form uses it.
 *
 * What matters is not that yup validates — yup's own tests cover that — but that
 * a yup schema passes through the framework's validator port intact, and that a
 * failure arrives as something a form can put next to an input.
 *
 * Those assertions are the family's, so they are imported rather than written
 * here: six packages promising the same thing in six copies of one test file is
 * six chances for one of them to quietly stop promising it.
 */
lankaValidatorConformance({
	vendor: "yup",
	validator: lankaYupValidator,
	signUp: playgroundSignUpSchema,
	apiShape: playgroundApiShapeSchema,
	toApi: playgroundToApiSchema,
});

describe("the yup playground's own form", () => {
	it("keeps the parsed value after a valid submission", () => {
		const form = createPlaygroundForm();

		expect(form.submit({ email: "ada@example.com", age: 36, tags: [{ id: 1 }] })).toBe(true);
		expect(form.state.value?.email).toBe("ada@example.com");
	});

	it("clears previous errors once a submission succeeds", () => {
		const form = createPlaygroundForm();

		form.submit({ email: "ada@example.com", age: 15, tags: [] });
		form.submit({ email: "ada@example.com", age: 36, tags: [] });

		expect(form.state.fieldErrors).toEqual([]);
	});

	it("throws on the strict path, naming the context", () => {
		const form = createPlaygroundForm();

		expect(() => form.parseOrThrow({ email: "ada@example.com", age: 15, tags: [] })).toThrow(
			/playground sign-up/,
		);
	});

	it("works through the SAME schema core's port refuses outright", () => {
		// The package's reason for existing, in the playground rather than only in a
		// unit test: this is the scene an adopter arrives with. The schema is a
		// promise-returning Standard Schema, so core refuses it — and the form built
		// on this package validates it synchronously all the same.
		expect(playgroundSignUpSchema["~standard"].validate({})).toBeInstanceOf(Promise);

		expect(createPlaygroundForm().submit({ email: "ada@example.com", age: 36, tags: [] })).toBe(
			true,
		);
	});
});
