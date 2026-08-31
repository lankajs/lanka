import { describe, expect, it } from "vitest";
import * as v from "valibot";
import { z } from "zod";
import { lankaStandardValidator } from "./lankaStandardValidator";
import { LankaValidationError } from "../lanka-validation-error/LankaValidationError";

/**
 * The validation port accepts ANY Standard Schema implementation.
 *
 * ## Why the test is written against valibot rather than zod
 *
 * A signature typed as `validate<T>(schema: ZodSchema<T>, …)` cannot accept
 * valibot PHYSICALLY: valibot has no `ZodSchema` type. A seam created for a
 * second validator that the second validator cannot pass is a seam nobody uses.
 *
 * An abstraction typed by its single implementation is not an abstraction, and
 * the only proof otherwise is a second implementation passing the same
 * assertions. zod is here too — as the SECOND case, not the primary one.
 */

const zodUser = z.object({ id: z.number(), name: z.string() });
const valibotUser = v.object({ id: v.number(), name: v.string() });

describe("lankaStandardValidator — any Standard Schema implementation", () => {
	it("passes valid data through, returning the parsed value (valibot)", () => {
		const parsed = lankaStandardValidator.validate(valibotUser, { id: 1, name: "Ann" }, "user");

		expect(parsed).toEqual({ id: 1, name: "Ann" });
	});

	it("passes valid data through, returning the parsed value (zod)", () => {
		const parsed = lankaStandardValidator.validate(zodUser, { id: 1, name: "Ann" }, "user");

		expect(parsed).toEqual({ id: 1, name: "Ann" });
	});

	it("throws LankaValidationError with field paths on invalid data (valibot)", () => {
		const failure = (() => {
			try {
				lankaStandardValidator.validate(valibotUser, { id: "no", name: 42 }, "user");
				return null;
			} catch (error) {
				return error as LankaValidationError;
			}
		})();

		expect(failure).toBeInstanceOf(LankaValidationError);
		expect(failure?.message).toContain("user");
		// The field path is why details are collected at all: without it there is
		// nothing to highlight for the user and nothing to look up for the
		// developer.
		expect(failure?.errors?.some((e) => e.includes("id"))).toBe(true);
		expect(failure?.errors?.some((e) => e.includes("name"))).toBe(true);
	});

	it("throws LankaValidationError with field paths on invalid data (zod)", () => {
		const failure = (() => {
			try {
				lankaStandardValidator.validate(zodUser, { id: "no", name: 42 }, "user");
				return null;
			} catch (error) {
				return error as LankaValidationError;
			}
		})();

		expect(failure).toBeInstanceOf(LankaValidationError);
		expect(failure?.errors?.some((e) => e.includes("id"))).toBe(true);
	});

	it("`validateSafe` returns an outcome instead of throwing", () => {
		const ok = lankaStandardValidator.validateSafe(valibotUser, { id: 1, name: "Ann" });
		const bad = lankaStandardValidator.validateSafe(valibotUser, { id: "no" });

		expect(ok).toEqual({ success: true, data: { id: 1, name: "Ann" } });
		expect(bad.success).toBe(false);
		if (!bad.success) expect(bad.errors.length).toBeGreaterThan(0);
	});

	it("a nested path is reported whole, not just its last segment", () => {
		const nested = v.object({ items: v.array(v.object({ id: v.number() })) });

		const result = lankaStandardValidator.validateSafe(nested, { items: [{ id: "no" }] });

		expect(result.success).toBe(false);
		if (!result.success) {
			// `items.0.id`, not `id`: without the index and the parent the message
			// points nowhere when the list has twenty items.
			expect(result.errors[0]).toContain("items.0.id");
		}
	});

	it("rejects an async schema loudly instead of passing it silently", () => {
		// Standard Schema allows `validate` to return a promise. A synchronous port
		// cannot await it, and answering "fine" would let unvalidated data through —
		// a check that cannot fail reporting success.
		const asyncSchema = v.pipeAsync(
			v.string(),
			v.checkAsync(() => Promise.resolve(true)),
		);

		expect(() =>
			lankaStandardValidator.validate(
				asyncSchema as unknown as Parameters<typeof lankaStandardValidator.validate>[0],
				"x",
				"async",
			),
		).toThrowError(/asynchronous/i);
	});
});
