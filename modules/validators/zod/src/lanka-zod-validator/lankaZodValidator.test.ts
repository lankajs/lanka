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

	it("recognises a CALLABLE Standard Schema, which is what arktype hands it", () => {
		/*
		 * An arktype schema is a function — `typeof schema === "function"` — with
		 * `~standard` on its prototype. A guard written as `typeof schema ===
		 * "object"` therefore answered "not Standard Schema" and sent it to the zod 3
		 * bridge, where it died on `schema.safeParse is not a function`.
		 *
		 * That is not a hypothetical: it is what an application mixing
		 * `@lankajs/zod` with an arktype schema got, and the error named zod rather
		 * than the mismatch. A fake rather than an arktype dependency here, because
		 * the property under test is callability, not arktype.
		 */
		const callable = Object.assign((value: unknown) => value, {
			"~standard": {
				version: 1 as const,
				vendor: "callable",
				validate: (data: unknown) =>
					typeof (data as { id?: unknown }).id === "number"
						? { value: data }
						: { issues: [{ message: "expected number", path: ["id"] }] },
			},
		});

		expect(
			lankaZodValidator.validate(
				callable as unknown as Parameters<typeof lankaZodValidator.validate>[0],
				{ id: 1 },
				"user",
			),
		).toEqual({ id: 1 });

		const failure = lankaZodValidator.validateSafe(callable, { id: "no" });

		expect(failure.success).toBe(false);
		if (!failure.success) expect(failure.errors[0]).toBe("id: expected number");
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

describe("the zod 3 bridge on the strict path", () => {
	it("throws with the label and every issue, not an outcome", () => {
		// `validate` and `validateSafe` are two different promises, and the bridge
		// has its own code for each. Testing only the safe one leaves the path a
		// gateway actually uses unexercised.
		const legacy = {
			safeParse: () => ({
				success: false as const,
				error: { issues: [{ path: ["id"], message: "expected number" }] },
			}),
		};

		expect(() =>
			lankaZodValidator.validate(
				legacy as unknown as Parameters<typeof lankaZodValidator.validate>[0],
				{},
				"todos.byId",
			),
		).toThrowError(/todos.byId.*id: expected number/);
	});
});

describe("a schema from another library", () => {
	/**
	 * An application whose schemas come from two libraries eventually hands one to
	 * the wrong validator. Before the guard the bridge read `safeParse` off a
	 * TypeBox schema and threw a raw TypeError out of `validateSafe` — naming zod
	 * for a mistake that was not zod's.
	 */
	const refuse = (schema: unknown) =>
		lankaZodValidator.validateSafe(
			schema as Parameters<typeof lankaZodValidator.validateSafe>[0],
			{},
		);

	it("refuses a schema that is neither Standard Schema nor zod 3", () => {
		expect(() => refuse({ [Symbol.for("TypeBox.Kind")]: "Object" })).toThrowError(
			/not a zod schema/i,
		);
	});

	it("names where such a schema belongs, so the message ends in an install", () => {
		expect(() => refuse({ nope: true })).toThrowError(/modules\/validators/);
	});

	it("keeps a path-less zod 3 issue as the message alone", () => {
		// A zod 3 refusal of the value AS A WHOLE has an empty path. `": message"`
		// with nothing before the colon is not an address, and a form reading it
		// would look for an input named "".
		const legacy = {
			safeParse: () => ({
				success: false as const,
				error: { issues: [{ path: [], message: "the whole body is wrong" }] },
			}),
		};

		const result = lankaZodValidator.validateSafe(
			legacy as unknown as Parameters<typeof lankaZodValidator.validateSafe>[0],
			{},
		);

		expect(result.success).toBe(false);
		if (!result.success) expect(result.errors).toEqual(["the whole body is wrong"]);
	});

	it("refuses a value that is not an object at all", () => {
		expect(() => refuse(null)).toThrowError(/not a zod schema/i);
		expect(() => refuse(42)).toThrowError(/not a zod schema/i);
		expect(() => refuse(undefined)).toThrowError(/not a zod schema/i);
	});
});
