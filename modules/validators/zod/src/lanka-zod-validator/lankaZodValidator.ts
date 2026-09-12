import { z } from "zod";
import { lankaStandardValidator, LankaValidationError } from "lanka/validation";
import type { ILankaValidator, TLankaValidationResult } from "lanka/validation";

/**
 * The validator for zod schemas.
 *
 * For zod 4 this is exactly `lankaStandardValidator`, re-exported under a name
 * that says which library it is for. For zod 3, which does not expose Standard
 * Schema, there is a bridge through `safeParse`.
 */
export const lankaZodValidator: ILankaValidator = Object.freeze<ILankaValidator>({
	validate(schema, data, context) {
		if (isStandardSchema(schema)) return lankaStandardValidator.validate(schema, data, context);
		return legacyValidate(schema, data, context);
	},
	validateSafe(schema, data) {
		if (isStandardSchema(schema)) return lankaStandardValidator.validateSafe(schema, data);
		return legacySafe(schema, data);
	},
});

/**
 * Whether the schema speaks Standard Schema.
 *
 * A schema may be a FUNCTION: arktype's is callable, with `~standard` on its
 * prototype. This guard read `typeof schema === "object"` once and therefore
 * answered "no" for every arktype schema, sending it to the zod 3 bridge, where
 * it died on `schema.safeParse is not a function` — an error naming zod for a
 * mistake that was not zod's.
 *
 * The specification says nothing about what a schema is made of, only that it
 * carries `~standard`, so the guard asks exactly that and nothing more.
 */
function isStandardSchema(schema: unknown): schema is Parameters<ILankaValidator["validate"]>[0] {
	if (schema === null) return false;

	return (typeof schema === "object" || typeof schema === "function") && "~standard" in schema;
}

/**
 * The zod 3 bridge.
 *
 * Here rather than in core for the same reason the package exists: it is
 * knowledge about a SPECIFIC library and its version. Core knows only the
 * protocol.
 */
function legacyValidate<TOutput>(schema: unknown, data: unknown, context: string): TOutput {
	const result = legacySafe<TOutput>(schema, data);
	if (result.success) return result.data;
	throw new Error(`Validation failed for ${context}: ${result.errors.join("; ")}`);
}

function legacySafe<TOutput>(schema: unknown, data: unknown): TLankaValidationResult<TOutput> {
	if (!isLegacyZodSchema(schema)) throw notAZodSchema();

	const parsed = (schema as z.ZodType).safeParse(data);
	if (parsed.success) return { success: true, data: parsed.data as TOutput };

	return {
		success: false,
		errors: parsed.error.issues.map((issue) => {
			const path = issue.path.join(".");
			return path ? `${path}: ${issue.message}` : issue.message;
		}),
	};
}

/**
 * Whether the value is a zod 3 schema — the only thing left once `~standard` is
 * absent.
 *
 * `safeParse` rather than `instanceof z.ZodType`: a duplicate copy of zod in a
 * dependency tree produces schemas that fail `instanceof` and work perfectly, and
 * refusing those would be a guard inventing a problem.
 */
function isLegacyZodSchema(schema: unknown): boolean {
	if (schema === null || schema === undefined) return false;
	if (typeof schema !== "object" && typeof schema !== "function") return false;

	return typeof (schema as { safeParse?: unknown }).safeParse === "function";
}

/**
 * The refusal for a value that is neither a Standard Schema nor a zod 3 schema.
 *
 * An application whose schemas come from two libraries eventually hands one to
 * the wrong validator. Unguarded, the bridge read `safeParse` off a TypeBox
 * schema and the consumer got "schema.safeParse is not a function" — an error
 * naming zod for a mistake that was not zod's, escaping `validateSafe` as a raw
 * `TypeError` when that method promises to throw nothing.
 *
 * It throws from `validateSafe` too, deliberately: a refused VALUE is an outcome
 * a form renders, while a schema this package cannot read is a wiring mistake,
 * and putting it in `errors` would show a programmer's error to a user beside an
 * input.
 */
function notAZodSchema(): LankaValidationError {
	return new LankaValidationError(
		"This is not a zod schema: it carries neither `~standard` nor `safeParse`. " +
			"Either it is not a schema at all, or it belongs to a library with its own " +
			"package in `modules/validators/` — yup, TypeBox and Effect each do.",
		[],
	);
}
