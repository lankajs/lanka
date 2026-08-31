import { describe, expect, it } from "vitest";

/**
 * Error body shapes.
 *
 * The failing cases matter as much as the passing ones: an extractor that
 * answers for a shape it does not know is worse than one that answers nothing —
 * the invented value travels on as if it were real.
 */
import { lankaMessageFromErrorList } from "./lankaMessageFromErrorList";

describe("lankaMessageFromErrorList", () => {
	it("takes the first string of the list", () => {
		expect(lankaMessageFromErrorList({ errors: ["First", "Second"] })).toBe("First");
	});

	it("takes `message` from an object in the list", () => {
		expect(lankaMessageFromErrorList({ errors: [{ message: "Bad request" }] })).toBe(
			"Bad request",
		);
	});

	it("takes `error` from an object when there is no `message`", () => {
		expect(lankaMessageFromErrorList({ errors: [{ error: "Denied" }] })).toBe("Denied");
	});

	it("skips empty items", () => {
		expect(lankaMessageFromErrorList({ errors: ["", "  ", "A real one"] })).toBe("A real one");
	});
});
