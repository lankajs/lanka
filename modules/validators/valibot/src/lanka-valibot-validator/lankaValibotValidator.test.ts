import { describe, expect, it } from "vitest";
import * as v from "valibot";
import { lankaValibotValidator } from "./lankaValibotValidator";

/**
 * The package shape matches `@lankajs/zod` and is asserted with the same set of
 * assertions, so "identical shape" is checked rather than claimed.
 */
describe("lankaValibotValidator", () => {
	it("accepts a valibot schema directly", () => {
		const schema = v.object({ id: v.number() });

		expect(lankaValibotValidator.validate(schema, { id: 1 }, "user")).toEqual({ id: 1 });
	});

	it("reports the field path", () => {
		const schema = v.object({ items: v.array(v.object({ id: v.number() })) });

		const result = lankaValibotValidator.validateSafe(schema, { items: [{ id: "no" }] });

		expect(result.success).toBe(false);
		if (!result.success) expect(result.errors[0]).toContain("items.0.id");
	});
});
