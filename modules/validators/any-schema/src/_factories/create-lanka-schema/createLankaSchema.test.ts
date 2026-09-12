import { describe, expect, it } from "vitest";
import { lankaStandardValidator } from "lanka/validation";
import { createLankaSchema } from "./createLankaSchema";
import { lankaSchemaDialect } from "../../lanka-schema-dialect/lankaSchemaDialect";

/**
 * A schema with no library behind it, read by the framework's own port.
 *
 * Driven through `lankaStandardValidator` rather than by calling `~standard`
 * directly, because "it produces a valid Standard Schema" is the claim, and the
 * only honest way to check it is to hand it to something that consumes one.
 */
const isRecord = (data: unknown): data is Record<string, unknown> =>
	typeof data === "object" && data !== null;

interface IOrder {
	id: string;
	total: number;
}

const orderSchema = createLankaSchema<IOrder>((data, issue) => {
	if (!isRecord(data)) {
		issue("expected an object");
		return {} as IOrder;
	}

	if (typeof data.id !== "string") issue("must be a string", ["id"]);
	if (typeof data.total !== "number") issue("must be a number", ["total"]);

	return { id: String(data.id), total: Number(data.total) };
});

describe("createLankaSchema", () => {
	it("is the `standard` dialect, so everything in the family already reads it", () => {
		expect(lankaSchemaDialect(orderSchema)).toBe("standard");
	});

	it("passes a valid value through core's port, returning what the reader built", () => {
		expect(
			lankaStandardValidator.validate(orderSchema, { id: "o-1", total: 20 }, "order"),
		).toEqual({ id: "o-1", total: 20 });
	});

	it("reports every issue the reader raised, not the first", () => {
		const result = lankaStandardValidator.validateSafe(orderSchema, { id: 1, total: "x" });

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.errors).toEqual(["id: must be a string", "total: must be a number"]);
		}
	});

	it("keeps the path in segments, so a form can reach the input", () => {
		const result = lankaStandardValidator.validateSafe(orderSchema, { id: 1, total: 20 });

		expect(result.success).toBe(false);
		if (!result.success) expect(result.fields?.[0].path).toEqual(["id"]);
	});

	it("gives a path-less issue the form's ROOT rather than an input named empty", () => {
		const result = lankaStandardValidator.validateSafe(orderSchema, "not an object");

		expect(result.success).toBe(false);
		if (!result.success) expect(result.fields?.[0].path).toEqual([]);
	});

	it("IGNORES the returned value when anything was reported", () => {
		// The property that lets a reader collect several problems and still end
		// with one `return`. Trusting the value would let a half-built object
		// through beside its own errors.
		const half = createLankaSchema<IOrder>((_data, issue) => {
			issue("nope");
			return { id: "built anyway", total: 0 };
		});

		expect(lankaStandardValidator.validateSafe(half, {}).success).toBe(false);
	});

	it("starts each call with an empty list, so one refusal does not haunt the next", () => {
		// A collector shared between calls is a schema that remembers the last body
		// it refused, and the bug surfaces as an unrelated request failing later.
		expect(lankaStandardValidator.validateSafe(orderSchema, { id: 1, total: 2 }).success).toBe(
			false,
		);
		expect(
			lankaStandardValidator.validateSafe(orderSchema, { id: "o-1", total: 2 }).success,
		).toBe(true);
		expect(lankaStandardValidator.validateSafe(orderSchema, { id: 1, total: 2 }).success).toBe(
			false,
		);
	});

	it("names its vendor, which is what a mixed application reads in a trace", () => {
		expect(orderSchema["~standard"].vendor).toBe("lanka");
		expect(createLankaSchema(() => null, "acme-protocol")["~standard"].vendor).toBe(
			"acme-protocol",
		);
	});

	it("survives every hostile value a wire produces", () => {
		for (const value of [null, undefined, [], 42, true, "", Object.create(null) as unknown]) {
			expect(lankaStandardValidator.validateSafe(orderSchema, value).success).toBe(false);
		}
	});

	it("lets a reader accept a value of any shape, including null", () => {
		// `unknown` means it: a schema for a nullable body is a legitimate schema,
		// and the factory must not decide that `null` is always wrong.
		const nullable = createLankaSchema<string | null>((data, issue) => {
			if (data === null || typeof data === "string") return data;

			issue("expected a string or null");
			return null;
		});

		expect(lankaStandardValidator.validate(nullable, null, "nullable")).toBeNull();
		expect(lankaStandardValidator.validateSafe(nullable, 42).success).toBe(false);
	});

	it("carries a transform, because the returned value IS the parsed value", () => {
		// The family's rule that a mapping is a schema holds here too, and with no
		// library it is simply the function's return.
		const fromWire = createLankaSchema<{ isActive: boolean }>((data, issue) => {
			if (!isRecord(data)) {
				issue("expected an object");
				return { isActive: false };
			}

			return { isActive: data.is_active === 1 };
		});

		expect(lankaStandardValidator.validate(fromWire, { is_active: 1 }, "wire")).toEqual({
			isActive: true,
		});
	});
});
