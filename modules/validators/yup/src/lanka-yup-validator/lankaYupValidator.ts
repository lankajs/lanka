import { ValidationError } from "yup";
import { LankaValidationError } from "lanka/validation";
import { lankaForeignSchemaMessage, lankaValueOrThrow } from "lanka/internal";
import type { Schema } from "yup";
import type { ILankaValidator, TLankaValidationResult } from "lanka/validation";
import type { ILankaFieldError } from "lanka/errors";
import { yupPathSegments } from "../_utils/yup-path-segments/yupPathSegments";

/**
 * The validator for yup schemas.
 *
 * ## Why this one is not an alias
 *
 * Every other thin package in `modules/validators/` re-exports core's port under a
 * vendor's name, because the library hands the port a synchronous Standard
 * Schema. yup does not. It implements the specification — since 1.7.x — but its
 * `~standard.validate` is declared `async`, so it returns a promise for every
 * schema, valid or not.
 *
 * Core's port is synchronous and refuses a promise loudly, because a port that
 * answered "fine" to a value it never inspected would let unvalidated data
 * through. The two facts together mean a yup schema cannot be validated by lanka
 * without this file: not slowly, not partially — every call throws.
 *
 * So the bridge goes through `validateSync`, which yup has had all along. It
 * lives here rather than in core for the same reason the zod 3 bridge does: it is
 * knowledge about a specific library and a specific version, and core knows only
 * the protocol.
 *
 * ## What a consumer gets back
 *
 * The same two shapes as every other package in the family — a thrown
 * `LankaValidationError` with the label in the message, or an outcome — with
 * paths in segments and messages as `"path: message"`. The family reads
 * identically because an application that swaps packages swaps the library, not
 * the way failures arrive.
 */
export const lankaYupValidator: ILankaValidator = Object.freeze<ILankaValidator>({
	validate<TOutput>(schema: unknown, data: unknown, context: string): TOutput {
		return lankaValueOrThrow(runSync<TOutput>(schema, data), context);
	},

	validateSafe<TOutput>(schema: unknown, data: unknown): TLankaValidationResult<TOutput> {
		return runSync<TOutput>(schema, data);
	},
});

/**
 * One synchronous pass, with every failing field rather than the first.
 *
 * `abortEarly: false` is not a preference: a form showing one message at a time
 * makes a user fix three fields in three round trips, and the port promises every
 * issue in `errors`.
 */
function runSync<TOutput>(schema: unknown, data: unknown): TLankaValidationResult<TOutput> {
	if (!isYupSchema(schema)) throw notAYupSchema(schema);

	try {
		return {
			success: true,
			data: schema.validateSync(data, { abortEarly: false }) as TOutput,
		};
	} catch (error) {
		if (ValidationError.isError(error)) return describeFailure(error);

		throw asLoudRefusal(error);
	}
}

/**
 * Anything yup threw that is not a refusal of the DATA.
 *
 * Two things arrive here. A test that returned a promise makes yup throw a plain
 * `Error` about "a Promise during a synchronous validate" — the commonest by a
 * distance, and the one a consumer can act on once it is named. And consumer code
 * inside a `test` or a `transform` can throw anything at all, including a value
 * that is not an `Error`.
 *
 * Both become the port's own refusal, carrying what yup said: passed through,
 * the first reads as a stray library message and the second can be `undefined`.
 */
function asLoudRefusal(error: unknown): LankaValidationError {
	const detail = error instanceof Error ? error.message : String(error);

	return new LankaValidationError(
		"yup could not validate this synchronously. The commonest cause is a test " +
			"that returns a promise: `validateSync` cannot await one, and answering " +
			'"fine" would be worse than failing. Parse such data by hand. ' +
			`yup said: ${detail}`,
		[],
	);
}

/**
 * Whether the value is a yup schema at all.
 *
 * An application whose schemas come from two libraries eventually hands one to
 * the wrong validator. Unguarded, `validateSync` was read off a zod schema and
 * the consumer got "schema.validateSync is not a function" — an error naming
 * neither library. Worse, it escaped `validateSafe`, which promises to throw
 * nothing, as a raw `TypeError` rather than anything a caller could branch on.
 *
 * `validateSync` rather than `instanceof yup.Schema`: a duplicate copy of yup in
 * a dependency tree produces schemas that fail `instanceof` and work perfectly,
 * and refusing those would be a guard inventing a problem.
 */
function isYupSchema(schema: unknown): schema is Schema {
	if (schema === null || schema === undefined) return false;
	if (typeof schema !== "object" && typeof schema !== "function") return false;

	return typeof (schema as { validateSync?: unknown }).validateSync === "function";
}

/**
 * The refusal for a schema from another library.
 *
 * It throws from `validateSafe` too, deliberately: a refused VALUE is an outcome
 * a form renders, while a schema this package cannot read is a wiring mistake,
 * and putting it in `errors` would show a programmer's error to a user beside an
 * input. Core refuses a non-Standard-Schema for the same reason and in the same
 * words.
 */
function notAYupSchema(schema: unknown): LankaValidationError {
	return new LankaValidationError(
		lankaForeignSchemaMessage(schema, {
			lead: "This is not a yup schema: it has no `validateSync`.",
		}),
		[],
	);
}

/** A yup refusal as the two lists the port promises: one for a banner, one for a form. */
function describeFailure<TOutput>(error: ValidationError): TLankaValidationResult<TOutput> {
	// `inner` holds every issue when `abortEarly` is false — except when yup never
	// reached the fields. A `transform` or a `lazy` that throws a `ValidationError`
	// produces one with an EMPTY `inner` and the message on the error itself, and
	// that is not an exotic case here: the mapping schemas this family recommends
	// are transforms. Reading `inner` alone would report a failure with no message.
	const issues = error.inner.length > 0 ? error.inner : [error];
	const fields = issues.map(toFieldError);

	return {
		success: false,
		errors: fields.map(describeField),
		fields,
	};
}

function toFieldError(issue: ValidationError): ILankaFieldError {
	return { path: yupPathSegments(issue.path), message: issue.message };
}

/**
 * A field path plus its message, for a banner.
 *
 * The path is assembled WHOLE — `tags.0.id`, not `id` — and joined with dots
 * rather than kept in yup's bracket spelling, because this string is read beside
 * the other five packages' and the family reads one way.
 */
function describeField(field: ILankaFieldError): string {
	const path = field.path.join(".");

	return path ? `${path}: ${field.message}` : field.message;
}
