import { describe, expect, it } from "vitest";

/**
 * Error body shapes.
 *
 * The failing cases matter as much as the passing ones: an extractor that
 * answers for a shape it does not know is worse than one that answers nothing —
 * the invented value travels on as if it were real.
 */
import { lankaMessageFromDetail } from "./lankaMessageFromDetail";

describe("lankaMessageFromDetail", () => {
	it("reads `detail` — the problem+json shape", () => {
		expect(lankaMessageFromDetail({ detail: "Insufficient rights" })).toBe(
			"Insufficient rights",
		);
	});
});
