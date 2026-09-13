import { describe, expect, it } from "vitest";
import { validateAtlasMissionInput } from "./validateAtlasMissionInput";

describe("validateAtlasMissionInput", () => {
	it("accepts a mission a person could actually have typed", () => {
		expect(validateAtlasMissionInput({ title: "Survey the north ridge", priority: 2 })).toEqual(
			{},
		);
	});

	it("reports every problem at once, because a form has a place for each", () => {
		// Stopping at the first makes somebody fix one field, submit, and be told
		// about the next.
		const errors = validateAtlasMissionInput({ title: "", priority: 9 });

		expect(Object.keys(errors).sort()).toEqual(["priority", "title"]);
	});

	it("refuses a title of whitespace, which is not a title", () => {
		expect(validateAtlasMissionInput({ title: "   " }).title).toBeDefined();
	});

	it("refuses a title too short to say anything", () => {
		expect(validateAtlasMissionInput({ title: "abc" }).title).toEqual([
			"a title is at least 4 characters",
		]);
	});

	it("leaves priority alone when nobody sent one", () => {
		// A PATCH carries what changed. Treating an absent field as an invalid one
		// makes every partial update fail.
		expect(validateAtlasMissionInput({ title: "Survey the ridge" })).toEqual({});
	});

	it("refuses a priority that is a number but not a whole one", () => {
		expect(
			validateAtlasMissionInput({ title: "Survey the ridge", priority: 1.5 }).priority,
		).toBeDefined();
	});
});
