import { describe, expect, it } from "vitest";
import * as v from "valibot";
import { z } from "zod";
import { lankaStandardValidator } from "./lankaStandardValidator";
import { LankaValidationError } from "../lanka-validation-error/LankaValidationError";
import type { StandardSchemaV1 } from "@standard-schema/spec";

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

	// `errors` joins the path into the text for a banner; a form needs the path
	// itself, in segments, because RHF and TanStack Form spell `items[1].qty`
	// differently and neither can be parsed back out of a string safely.
	it("carries every issue as a field with its path in segments", () => {
		const nested = v.object({ items: v.array(v.object({ qty: v.number() })) });
		const failure = (() => {
			try {
				lankaStandardValidator.validate(
					nested,
					{ items: [{ qty: 1 }, { qty: "x" }] },
					"order",
				);
				return null;
			} catch (error) {
				return error as LankaValidationError;
			}
		})();

		expect(failure?.fields).toEqual([
			{ path: ["items", 1, "qty"], message: expect.any(String) },
		]);
	});

	it("gives a cross-field refusal an EMPTY path — the form's root, not an input", () => {
		// "The dates are in the wrong order" belongs to no single input. Standard
		// Schema reports it with no path, and that is kept as `[]` rather than
		// dropped or invented: an adapter routes an empty path to the form's root.
		const range = v.pipe(
			v.object({ from: v.number(), to: v.number() }),
			v.check((value) => value.from <= value.to, "from must not be after to"),
		);
		const failure = (() => {
			try {
				lankaStandardValidator.validate(range, { from: 5, to: 1 }, "range");
				return null;
			} catch (error) {
				return error as LankaValidationError;
			}
		})();

		expect(failure?.fields).toEqual([{ path: [], message: "from must not be after to" }]);
		expect(failure?.errors).toEqual(["from must not be after to"]);
	});

	it("reads an object path segment by its key", () => {
		// Standard Schema allows `{ key }` objects in a path; the segment a form
		// wants is the key, never the wrapper.
		const schema: StandardSchemaV1<unknown, unknown> = {
			"~standard": {
				version: 1,
				vendor: "test",
				validate: () => ({ issues: [{ message: "bad", path: [{ key: "a" }, 0] }] }),
			},
		};

		const failure = (() => {
			try {
				lankaStandardValidator.validate(schema, {}, "thing");
				return null;
			} catch (error) {
				return error as LankaValidationError;
			}
		})();

		expect(failure?.fields).toEqual([{ path: ["a", 0], message: "bad" }]);
		expect(failure?.errors).toEqual(["a.0: bad"]);
	});

	it("`validateSafe` returns an outcome instead of throwing", () => {
		const ok = lankaStandardValidator.validateSafe(valibotUser, { id: 1, name: "Ann" });
		const bad = lankaStandardValidator.validateSafe(valibotUser, { id: "no" });

		expect(ok).toEqual({ success: true, data: { id: 1, name: "Ann" } });
		expect(bad.success).toBe(false);
		if (!bad.success) expect(bad.errors.length).toBeGreaterThan(0);
	});

	it("`validateSafe` carries the fields too — a ViewModel holding the inputs reads them from here", () => {
		const bad = lankaStandardValidator.validateSafe(valibotUser, { id: 1, name: 42 });

		expect(bad.success).toBe(false);
		if (!bad.success) {
			expect(bad.fields).toEqual([{ path: ["name"], message: expect.any(String) }]);
		}
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

	it("refuses a value that is not a Standard Schema, naming what it was handed", () => {
		/*
		 * An application with schemas from two libraries eventually passes one to
		 * the wrong validator. Before this, `schema["~standard"].validate(data)`
		 * read `undefined.validate` and the consumer got
		 * "Cannot read properties of undefined (reading 'validate')" — an error
		 * that names neither the schema, nor the port, nor what to do.
		 *
		 * It throws from `validateSafe` too, and that is deliberate. A refused
		 * VALUE is an outcome a form renders; a schema the port cannot read is a
		 * wiring mistake, and putting it in `errors` would show a programmer's
		 * error to a user beside an input.
		 */
		const notASchema = { parse: (data: unknown) => data };

		expect(() =>
			lankaStandardValidator.validate(
				notASchema as unknown as Parameters<typeof lankaStandardValidator.validate>[0],
				{},
				"user",
			),
		).toThrowError(/not a Standard Schema/i);

		expect(() =>
			lankaStandardValidator.validateSafe(
				notASchema as unknown as Parameters<typeof lankaStandardValidator.validateSafe>[0],
				{},
			),
		).toThrowError(/not a Standard Schema/i);
	});

	it("accepts a CALLABLE schema, which is what arktype is", () => {
		// arktype's schema is a function with `~standard` on its prototype. A guard
		// written as `typeof schema === "object"` would refuse every arktype schema
		// while claiming the port accepts arktype.
		const callable = Object.assign((value: unknown) => value, {
			"~standard": {
				version: 1 as const,
				vendor: "callable",
				validate: (data: unknown) => ({ value: data }),
			},
		});

		expect(
			lankaStandardValidator.validate(
				callable as unknown as Parameters<typeof lankaStandardValidator.validate>[0],
				{ id: 1 },
				"user",
			),
		).toEqual({ id: 1 });
	});

	it("hands back a PLAIN array, even when the library's path is an Array subclass", () => {
		/*
		 * arktype reports `issue.path` as its own `ReadonlyPath` — an Array subclass
		 * carrying a `cache` property of stringified ancestors. `Array.prototype.map`
		 * preserves the subclass (ArraySpeciesCreate), so a path built with `map`
		 * came back as a ReadonlyPath with a library internal hanging off it.
		 *
		 * `ILankaFieldError.path` promises segments. A consumer comparing, cloning
		 * or logging one would carry arktype's cache into their own code, and
		 * `toEqual(["items", 0, "id"])` failed against a value that printed
		 * identically — the worst kind of wrong answer.
		 */
		class VendorPath extends Array<string | number> {
			cache = { stringifyAncestors: ["", "items"] };
		}

		const schema: StandardSchemaV1<unknown, unknown> = {
			"~standard": {
				version: 1,
				vendor: "test",
				validate: () => ({
					issues: [
						{ message: "not a number", path: VendorPath.from(["items", 0, "id"]) },
					],
				}),
			},
		};

		const result = lankaStandardValidator.validateSafe(schema, {});

		expect(result.success).toBe(false);
		if (!result.success) {
			const [field] = result.fields ?? [];

			expect(field.path).toEqual(["items", 0, "id"]);
			expect(Object.getPrototypeOf(field.path)).toBe(Array.prototype);
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
