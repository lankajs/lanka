import { describe, expect, it } from "vitest";
import { z } from "zod";
import { lankaZodValidator } from "./lankaZodValidator";

/**
 * The package exists to make the library choice EXPLICIT, not to translate.
 *
 * So two things are asserted: zod 4 schemas pass through directly (core accepts
 * Standard Schema), and a schema that does not expose the specification still
 * works — which is what the bridge is for.
 */
describe("lankaZodValidator", () => {
	it("accepts a zod 4 schema directly", () => {
		const schema = z.object({ id: z.number() });

		expect(lankaZodValidator.validate(schema, { id: 1 }, "user")).toEqual({ id: 1 });
	});

	it("reports the field path", () => {
		const schema = z.object({ items: z.array(z.object({ id: z.number() })) });

		const result = lankaZodValidator.validateSafe(schema, { items: [{ id: "no" }] });

		expect(result.success).toBe(false);
		if (!result.success) expect(result.errors[0]).toContain("items.0.id");
	});

	it("the bridge works for a schema without Standard Schema", () => {
		// How a zod 3 schema looks to the bridge: `safeParse` present, `~standard`
		// absent. A fake rather than a real zod 3, which is more honest than
		// installing a second major of the same library for one assertion: the
		// bridge distinguishes schemas exactly by `~standard`, and that is what is
		// checked.
		const legacy = {
			safeParse: (data: unknown) =>
				typeof (data as { id?: unknown }).id === "number"
					? { success: true as const, data }
					: {
							success: false as const,
							error: { issues: [{ path: ["id"], message: "expected number" }] },
						},
		};

		expect(
			lankaZodValidator.validate(
				legacy as unknown as Parameters<typeof lankaZodValidator.validate>[0],
				{ id: 1 },
				"user",
			),
		).toEqual({ id: 1 });

		const failure = lankaZodValidator.validateSafe(
			legacy as unknown as Parameters<typeof lankaZodValidator.validateSafe>[0],
			{ id: "no" },
		);
		expect(failure.success).toBe(false);
		if (!failure.success) expect(failure.errors[0]).toBe("id: expected number");
	});
});
