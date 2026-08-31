import { describe, expect, it } from "vitest";
import { bigIntToString, stringToBigInt } from "./stringBigIntCodec";

describe("stringBigIntCodec", () => {
	it("returns the string exactly", () => {
		expect(bigIntToString(stringToBigInt("test"))).toBe("test");
	});

	it("the same input yields the same number", () => {
		expect(stringToBigInt("test")).toBe(stringToBigInt("test"));
	});

	it("different strings yield different numbers", () => {
		// Not a hash: collisions are impossible by construction, not by probability.
		expect(stringToBigInt("ab")).not.toBe(stringToBigInt("ba"));
		expect(stringToBigInt("a")).not.toBe(stringToBigInt("aa"));
	});

	it("survives all of Unicode, surrogate pairs included", () => {
		// prettier-ignore
		for (const value of ["Привет", "こんにちは", "مرحبا", "🌍🌎🌏"]) { // check-docs:allow — fixture data
			expect(bigIntToString(stringToBigInt(value))).toBe(value);
		}
	});

	it("the empty string and zero are the same thing", () => {
		expect(stringToBigInt("")).toBe(0n);
		expect(bigIntToString(0n)).toBe("");
	});

	it("leading zero bytes are not lost", () => {
		// This is why the length is a separate field: without it a string of zero
		// bytes decodes shorter than it was.
		const value = String.fromCharCode(0, 0, 65);
		expect(bigIntToString(stringToBigInt(value))).toBe(value);
	});

	it("a number the codec did not issue reads as an empty string", () => {
		// Inventing content from an unrecognised number is worse than reporting
		// nothing: the invention travels on as if it were real.
		expect(bigIntToString(-1n)).toBe("");
	});
});
