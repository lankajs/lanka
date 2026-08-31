import { z } from "zod";
import { lankaStandardValidator } from "lanka/validation";
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

function isStandardSchema(schema: unknown): schema is Parameters<ILankaValidator["validate"]>[0] {
	return typeof schema === "object" && schema !== null && "~standard" in schema;
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
