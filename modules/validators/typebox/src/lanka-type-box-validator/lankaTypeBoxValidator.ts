import { KindGuard } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { LankaValidationError } from "lanka/validation";
import type { Static, TSchema } from "@sinclair/typebox";
import type { ValueError } from "@sinclair/typebox/value";
import type { TLankaValidationResult } from "lanka/validation";
import type { ILankaFieldError } from "lanka/errors";
import { compiledTypeBoxSchema } from "../_internal/compiled-type-box-schema/compiledTypeBoxSchema";
import { typeBoxPointerSegments } from "../_utils/type-box-pointer-segments/typeBoxPointerSegments";

/**
 * The validator's shape, typed by a TypeBox schema rather than by core's port.
 *
 * `ILankaValidator` takes a `TLankaSchema` — a Standard Schema — and TypeBox
 * publishes none, so a validator declared as the port would reject every schema a
 * consumer of this package has. The SHAPE is the port's, member for member, and
 * `check:family` holds the barrel to the family's surface; what differs is the
 * one type the library makes impossible to share.
 */
export interface ILankaTypeBoxValidator {
	/** Validates and returns the parsed value, or throws. */
	validate<TSchemaType extends TSchema>(
		schema: TSchemaType,
		data: unknown,
		context: string,
	): Static<TSchemaType>;
	/** Validates and returns an outcome, throwing nothing. */
	validateSafe<TSchemaType extends TSchema>(
		schema: TSchemaType,
		data: unknown,
	): TLankaValidationResult<Static<TSchemaType>>;
}

/**
 * The validator for TypeBox schemas.
 *
 * ## Why this one is a bridge
 *
 * TypeBox publishes no `~standard` at all — not asynchronously as yup does, not
 * at all — so core's port cannot be handed a TypeBox schema and the package is
 * what makes the library usable here.
 *
 * ## What it costs, and why the cache is not premature
 *
 * `TypeCompiler.Compile(schema)` produces the fastest validator in JavaScript,
 * and compiling is the slow part. Compiled per call, this would be the slowest
 * package in the family while claiming to be the fastest. The checker is cached
 * per schema instead — see `compiledTypeBoxSchema`.
 *
 * A schema built inside a component body is a new object on every render and
 * therefore a new cache key. Declare schemas at module level, which is where they
 * belong for every other reason too.
 */
export const lankaTypeBoxValidator: ILankaTypeBoxValidator = Object.freeze<ILankaTypeBoxValidator>({
	validate<TSchemaType extends TSchema>(
		schema: TSchemaType,
		data: unknown,
		context: string,
	): Static<TSchemaType> {
		const result = runCompiled(schema, data);

		if (!result.success) {
			throw new LankaValidationError(
				`Validation failed for ${context}`,
				result.errors,
				result.fields,
			);
		}

		return result.data;
	},

	validateSafe<TSchemaType extends TSchema>(
		schema: TSchemaType,
		data: unknown,
	): TLankaValidationResult<Static<TSchemaType>> {
		return runCompiled(schema, data);
	},
});

/**
 * One pass through the compiled checker, and a second only if the schema asks.
 *
 * `Value.Decode` applies transforms AND re-checks, so calling it unconditionally
 * would validate every body twice. Whether the schema transforms at all is
 * answered once per schema and cached beside the checker.
 */
function runCompiled<TSchemaType extends TSchema>(
	schema: TSchemaType,
	data: unknown,
): TLankaValidationResult<Static<TSchemaType>> {
	if (!KindGuard.IsSchema(schema)) throw notATypeBoxSchema(schema);

	const { check, transforms } = compiledTypeBoxSchema(schema);

	if (!check.Check(data)) return describeFailure([...check.Errors(data)]);
	if (!transforms) return { success: true, data: data as Static<TSchemaType> };

	return decode(schema, data);
}

/**
 * The refusal for a schema from another library.
 *
 * An application whose schemas come from two libraries eventually hands one to
 * the wrong validator. Unguarded, `TypeCompiler.Compile` was handed a zod schema
 * and threw `TypeCompilerTypeGuardError: Preflight validation check failed` —
 * accurate, and useless to anyone who has not read TypeBox's source. It escaped
 * `validateSafe`, which promises to throw nothing, as a raw library error.
 *
 * `KindGuard.IsSchema` is TypeBox's own answer to the question, so the guard
 * cannot drift from what `Compile` will accept.
 *
 * It throws from `validateSafe` too, deliberately: a refused VALUE is an outcome
 * a form renders, while a schema this package cannot read is a wiring mistake,
 * and putting it in `errors` would show a programmer's error to a user beside an
 * input.
 */
function notATypeBoxSchema(schema: unknown): LankaValidationError {
	const standard =
		(typeof schema === "object" || typeof schema === "function") &&
		schema !== null &&
		"~standard" in schema;

	return new LankaValidationError(
		"This is not a TypeBox schema: it carries no `Kind`. " +
			(standard
				? "It does carry `~standard`, so it belongs to another library in " +
					"`modules/validators/` — validate it with that package's validator, or with " +
					"`lankaStandardValidator`."
				: "Either it is not a schema at all, or it belongs to a library with its own " +
					"package in `modules/validators/`."),
		[],
	);
}

/**
 * The transform pass, for a schema that has one.
 *
 * A decode function is consumer code and may throw — a date that does not parse,
 * an enum with no case for the value. That is a refusal of the body, not a crash
 * of the validator, so it comes back as one: `validateSafe` promises to throw
 * nothing.
 */
function decode<TSchemaType extends TSchema>(
	schema: TSchemaType,
	data: unknown,
): TLankaValidationResult<Static<TSchemaType>> {
	try {
		return { success: true, data: Value.Decode(schema, data) };
	} catch (error) {
		const message = decodeFailureMessage(error);

		return { success: false, errors: [message], fields: [{ path: [], message }] };
	}
}

/**
 * What a failed decode should SAY.
 *
 * TypeBox wraps whatever the decode function threw in a `TransformDecodeError`
 * and copies across a message only when the thrown value was an `Error` —
 * anything else becomes the literal string "Unknown error", which tells a
 * consumer nothing about their own code. The original is kept on `.error`, so
 * that is what is read first.
 */
function decodeFailureMessage(error: unknown): string {
	const original = (error as { error?: unknown }).error ?? error;

	return original instanceof Error ? original.message : String(original);
}

/** A TypeBox failure as the two lists the port promises: one for a banner, one for a form. */
function describeFailure<TOutput>(errors: ValueError[]): TLankaValidationResult<TOutput> {
	const fields = errors.map(toFieldError);

	return { success: false, errors: fields.map(describeField), fields };
}

function toFieldError(error: ValueError): ILankaFieldError {
	return { path: typeBoxPointerSegments(error.path), message: error.message };
}

/**
 * A field path plus its message, for a banner.
 *
 * Dots rather than TypeBox's pointer spelling, because this string is read beside
 * the other five packages' and the family reads one way.
 */
function describeField(field: ILankaFieldError): string {
	const path = field.path.join(".");

	return path ? `${path}: ${field.message}` : field.message;
}
