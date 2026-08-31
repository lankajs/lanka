import { describe, expect, it } from "vitest";

/**
 * Error body shapes.
 *
 * The failing cases matter as much as the passing ones: an extractor that
 * answers for a shape it does not know is worse than one that answers nothing —
 * the invented value travels on as if it were real.
 */
import { lankaMessageFromFieldErrors } from "./lankaMessageFromFieldErrors";

describe("lankaMessageFromFieldErrors", () => {
	it("takes the first message of the first field", () => {
		expect(lankaMessageFromFieldErrors({ errors: { email: ["Invalid address"] } })).toBe(
			"Invalid address",
		);
	});

	it("reads an object with `message` inside a field", () => {
		expect(lankaMessageFromFieldErrors({ errors: { email: [{ message: "Taken" }] } })).toBe(
			"Taken",
		);
	});

	it("a string instead of an array is also a message", () => {
		expect(lankaMessageFromFieldErrors({ errors: { email: "Invalid address" } })).toBe(
			"Invalid address",
		);
	});

	it("skips an empty field and takes the next", () => {
		// A first field with an empty list is ordinary in validation responses;
		// stopping there would show an empty banner.
		expect(lankaMessageFromFieldErrors({ errors: { email: [], phone: ["Too short"] } })).toBe(
			"Too short",
		);
	});

	it("invents no other shape", () => {
		expect(lankaMessageFromFieldErrors({ errors: ["A flat list"] })).toBeUndefined();
		expect(lankaMessageFromFieldErrors({ message: "Present, but not here" })).toBeUndefined();
	});
});
