import { describe, expect, it } from "vitest";
import { Type } from "@sinclair/typebox";
import { compiledTypeBoxSchema } from "./compiledTypeBoxSchema";

/**
 * The cache, driven directly.
 *
 * Its whole job is not to do work twice, and "did not do work twice" has no
 * observable effect other than identity. A timing assertion would be the wrong
 * instrument: it passes on an idle machine and fails on a busy one, for reasons
 * nobody caused.
 */
describe("compiledTypeBoxSchema", () => {
	it("compiles a schema once and hands back the same checker", () => {
		const schema = Type.Object({ id: Type.Number() });

		expect(compiledTypeBoxSchema(schema)).toBe(compiledTypeBoxSchema(schema));
	});

	it("compiles a different schema separately", () => {
		expect(compiledTypeBoxSchema(Type.Number())).not.toBe(compiledTypeBoxSchema(Type.String()));
	});

	it("answers whether the schema transforms, so a second pass is only paid when needed", () => {
		const plain = Type.Object({ id: Type.Number() });
		const mapping = Type.Object({
			id: Type.Transform(Type.String())
				.Decode((text) => text.length)
				.Encode((length: number) => "x".repeat(length)),
		});

		expect(compiledTypeBoxSchema(plain).transforms).toBe(false);
		// Nested, because a transform anywhere inside means the value must be
		// decoded — a top-level check would miss it.
		expect(compiledTypeBoxSchema(mapping).transforms).toBe(true);
	});

	it("produces a checker that actually checks", () => {
		const { check } = compiledTypeBoxSchema(Type.Object({ id: Type.Number() }));

		expect(check.Check({ id: 1 })).toBe(true);
		expect(check.Check({ id: "no" })).toBe(false);
	});
});
