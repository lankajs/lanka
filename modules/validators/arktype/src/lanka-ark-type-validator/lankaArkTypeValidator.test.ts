import { describe, expect, it } from "vitest";
import { type } from "arktype";
import { lankaStandardValidator } from "lanka/validation";
import { lankaArkTypeValidator } from "./lankaArkTypeValidator";

/**
 * The package's shape matches the rest of `modules/validators/` and is asserted
 * with the same set of assertions, so "identical shape" is checked rather than
 * claimed. The scenes a form drives are in `_playground/`, through the shared
 * conformance suite.
 */
describe("lankaArkTypeValidator", () => {
	it("is core's validator rather than a copy of it", () => {
		// Identity, not behaviour: a re-implementation here would be a second
		// behaviour under one name, and it would stop following core's changes.
		expect(lankaArkTypeValidator).toBe(lankaStandardValidator);
	});

	it("accepts an arktype schema directly", () => {
		const schema = type({ id: "number" });

		expect(lankaArkTypeValidator.validate(schema, { id: 1 }, "user")).toEqual({ id: 1 });
	});

	it("reports the field path", () => {
		const schema = type({ items: type({ id: "number" }).array() });

		const result = lankaArkTypeValidator.validateSafe(schema, { items: [{ id: "no" }] });

		expect(result.success).toBe(false);
		if (!result.success) expect(result.errors.join(" ")).toContain("items.0.id");
	});
});
