import { describe, expect, it } from "vitest";

/**
 * Error body shapes.
 *
 * The failing cases matter as much as the passing ones: an extractor that
 * answers for a shape it does not know is worse than one that answers nothing —
 * the invented value travels on as if it were real.
 */
import { lankaFirstOf } from "./lankaFirstOf";
import { lankaMessageFromFieldErrors } from "../lanka-message-from-field-errors/lankaMessageFromFieldErrors";
import { lankaMessageFromDetail } from "../lanka-message-from-detail/lankaMessageFromDetail";
import { lankaMessageFromErrorList } from "../lanka-message-from-error-list/lankaMessageFromErrorList";

describe("lankaFirstOf", () => {
	it("the first one to find something wins", () => {
		const extract = lankaFirstOf(
			lankaMessageFromFieldErrors,
			lankaMessageFromErrorList,
			lankaMessageFromDetail,
		);

		expect(extract({ errors: { email: ["Field"] } })).toBe("Field");
		expect(extract({ errors: ["List"] })).toBe("List");
		expect(extract({ detail: "Detail" })).toBe("Detail");
	});

	it("order matters and is set by the application", () => {
		// A body matching two shapes at once is not rare. The order must be the
		// APPLICATION's, not whichever shape sits higher in framework code.
		const body = { errors: { email: ["Field"] }, detail: "Detail" };

		expect(lankaFirstOf(lankaMessageFromFieldErrors, lankaMessageFromDetail)(body)).toBe(
			"Field",
		);
		expect(lankaFirstOf(lankaMessageFromDetail, lankaMessageFromFieldErrors)(body)).toBe(
			"Detail",
		);
	});

	it("nothing found yields `undefined`, not an empty string", () => {
		expect(lankaFirstOf(lankaMessageFromFieldErrors)({})).toBeUndefined();
	});
});
