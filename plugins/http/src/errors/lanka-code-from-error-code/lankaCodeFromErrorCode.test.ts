import { describe, expect, it } from "vitest";

/**
 * Error body shapes.
 *
 * The failing cases matter as much as the passing ones: an extractor that
 * answers for a shape it does not know is worse than one that answers nothing —
 * the invented value travels on as if it were real.
 */
import { lankaCodeFromErrorCode } from "./lankaCodeFromErrorCode";

describe("lankaCodeFromErrorCode", () => {
	it("takes `errorCode`", () => {
		expect(lankaCodeFromErrorCode({ errorCode: "GAP_LOCKED" })).toBe("GAP_LOCKED");
	});

	it("takes `error` when there is no `errorCode`", () => {
		expect(lankaCodeFromErrorCode({ error: "NOT_AUTHORIZED" })).toBe("NOT_AUTHORIZED");
	});

	it("prefers `errorCode` when both are present", () => {
		expect(lankaCodeFromErrorCode({ errorCode: "A", error: "B" })).toBe("A");
	});

	it("an empty string is the absence of a code, not a code", () => {
		// Otherwise the screen would branch on the code `""`, find no branch, and
		// do so silently.
		expect(lankaCodeFromErrorCode({ errorCode: "   " })).toBeUndefined();
	});

	it("a non-string is not a code", () => {
		expect(lankaCodeFromErrorCode({ errorCode: 42 })).toBeUndefined();
		expect(lankaCodeFromErrorCode(null)).toBeUndefined();
		expect(lankaCodeFromErrorCode("text")).toBeUndefined();
	});
});
