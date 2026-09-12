import { describe, expect, it } from "vitest";

/**
 * The same body `lankaMessageFromFieldErrors` reads for a banner, read for a
 * FORM: every message, each with the address of the input it belongs to.
 *
 * The failing cases matter as much as the passing ones: an extractor that
 * answers for a shape it does not know is worse than one that answers nothing.
 */
import { lankaFieldsFromErrorMap } from "./lankaFieldsFromErrorMap";

describe("lankaFieldsFromErrorMap", () => {
	it("gives every field its message", () => {
		expect(
			lankaFieldsFromErrorMap({
				errors: { email: ["Invalid address"], phone: ["Too short"] },
			}),
		).toEqual([
			{ path: ["email"], message: "Invalid address" },
			{ path: ["phone"], message: "Too short" },
		]);
	});

	it("keeps every message of one field, not just the first", () => {
		// The banner takes the first; a form has a place for all of them, which is
		// the whole reason this extractor exists beside that one.
		expect(lankaFieldsFromErrorMap({ errors: { email: ["Required", "Too short"] } })).toEqual([
			{ path: ["email"], message: "Required" },
			{ path: ["email"], message: "Too short" },
		]);
	});

	it("splits a dotted address into segments, an index as a number", () => {
		// `items.1.qty` reaches the second row's quantity. Joined, it reaches
		// nothing: a form spells that address `items.1.qty` or `items[1].qty`, and
		// only the producer knows which segment was an index.
		expect(lankaFieldsFromErrorMap({ errors: { "items.1.qty": ["Only 2 left"] } })).toEqual([
			{ path: ["items", 1, "qty"], message: "Only 2 left" },
		]);
	});

	it("reads a bracketed address too", () => {
		expect(lankaFieldsFromErrorMap({ errors: { "items[1].qty": ["Only 2 left"] } })).toEqual([
			{ path: ["items", 1, "qty"], message: "Only 2 left" },
		]);
	});

	it("takes a message named beside its code", () => {
		expect(
			lankaFieldsFromErrorMap({
				errors: { qty: [{ message: "Only 2 left", code: "STOCK" }] },
			}),
		).toEqual([{ path: ["qty"], message: "Only 2 left", code: "STOCK" }]);
	});

	it("a string instead of a list is also a message", () => {
		expect(lankaFieldsFromErrorMap({ errors: { email: "Invalid address" } })).toEqual([
			{ path: ["email"], message: "Invalid address" },
		]);
	});

	it("gives the form-wide key an EMPTY path — the root, not an input named so", () => {
		// Many backends put a cross-field refusal under a reserved key. An address
		// of `""` would be an input nothing renders.
		expect(
			lankaFieldsFromErrorMap({ errors: { "": ["The dates are in the wrong order"] } }),
		).toEqual([{ path: [], message: "The dates are in the wrong order" }]);
	});

	it("skips a field with nothing to say", () => {
		expect(lankaFieldsFromErrorMap({ errors: { email: [], phone: ["Too short"] } })).toEqual([
			{ path: ["phone"], message: "Too short" },
		]);
	});

	it("invents no other shape", () => {
		expect(lankaFieldsFromErrorMap({ errors: ["A flat list"] })).toBeUndefined();
		expect(lankaFieldsFromErrorMap({ message: "Present, but not here" })).toBeUndefined();
		expect(lankaFieldsFromErrorMap("not a body")).toBeUndefined();
	});

	it("answers nothing rather than an empty list when it recognised no message", () => {
		// `undefined` is what `lankaFirstOf` folds on and what the middleware reads
		// as "this extractor did not know the shape". An empty list would claim it
		// did and found nothing.
		expect(lankaFieldsFromErrorMap({ errors: { email: [] } })).toBeUndefined();
	});
});
