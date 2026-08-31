import type { StandardSchemaV1 } from "@standard-schema/spec";
import { LankaValidationError } from "../lanka-validation-error/LankaValidationError";
import type { TLankaValidationResult } from "../_types/TLankaValidationResult";

/**
 * Response body validation with any Standard Schema implementation.
 *
 * An abstraction typed by one library cannot be implemented by another, which is
 * the whole reason a validation port exists. Standard Schema is the shared
 * interface implemented by zod 4, valibot, arktype and others.
 *
 * `@standard-schema/spec` contains TYPES ONLY and adds no bytes to a build, so it
 * is a regular dependency rather than another peer.
 *
 * No adapter classes: a schema describes itself, and
 * `schema["~standard"].validate(data)` is the whole protocol.
 */

/** A schema the port understands: any Standard Schema implementation. */
export type TLankaSchema<TOutput = unknown> = StandardSchemaV1<unknown, TOutput>;

export interface ILankaValidator {
	/** Validates and returns the parsed value, or throws. */
	validate<TOutput>(schema: TLankaSchema<TOutput>, data: unknown, context: string): TOutput;
	/** Validates and returns an outcome, throwing nothing. */
	validateSafe<TOutput>(
		schema: TLankaSchema<TOutput>,
		data: unknown,
	): TLankaValidationResult<TOutput>;
}

/**
 * A field path plus a message.
 *
 * The path is assembled WHOLE — `items.0.id`, not `id`. Without the index and the
 * parent the message points nowhere when the list has twenty items.
 */
function describeIssue(issue: StandardSchemaV1.Issue): string {
	const path = (issue.path ?? [])
		.map((segment) =>
			typeof segment === "object" && segment !== null && "key" in segment
				? String(segment.key)
				: String(segment),
		)
		.join(".");

	return path ? `${path}: ${issue.message}` : issue.message;
}

function runSync<TOutput>(
	schema: TLankaSchema<TOutput>,
	data: unknown,
): StandardSchemaV1.Result<TOutput> {
	const result = schema["~standard"].validate(data);

	// Standard Schema allows returning a promise. A synchronous port cannot await
	// it, and answering "fine" would let UNVALIDATED data through — a check that
	// cannot fail reporting success.
	if (result instanceof Promise) {
		throw new LankaValidationError(
			"The schema is asynchronous and the validation port is synchronous. Parse " +
				"such data by hand: passing it silently would be worse than failing.",
			[],
		);
	}

	return result;
}

export const lankaStandardValidator: ILankaValidator = Object.freeze<ILankaValidator>({
	validate<TOutput>(schema: TLankaSchema<TOutput>, data: unknown, context: string): TOutput {
		const result = runSync(schema, data);

		if (result.issues) {
			throw new LankaValidationError(
				`Validation failed for ${context}`,
				result.issues.map(describeIssue),
			);
		}

		return result.value;
	},

	validateSafe<TOutput>(
		schema: TLankaSchema<TOutput>,
		data: unknown,
	): TLankaValidationResult<TOutput> {
		const result = runSync(schema, data);

		if (result.issues) {
			return { success: false, errors: result.issues.map(describeIssue) };
		}

		return { success: true, data: result.value };
	},
});
