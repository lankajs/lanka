import { Clone, DecodeUnsafe } from "typebox/value";
import { LankaValidationError } from "lanka/validation";
import { lankaForeignSchemaMessage, lankaValueOrThrow } from "lanka/internal";
import type { StaticDecode, TSchema } from "typebox";
import type { TLocalizedValidationError } from "typebox/error";
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
	): StaticDecode<TSchemaType>;
	/** Validates and returns an outcome, throwing nothing. */
	validateSafe<TSchemaType extends TSchema>(
		schema: TSchemaType,
		data: unknown,
	): TLankaValidationResult<StaticDecode<TSchemaType>>;
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
 * `Compile(schema)` produces the fastest validator in JavaScript, and compiling
 * is the slow part. Compiled per call, this would be the slowest package in the
 * family while claiming to be the fastest. The checker is cached per schema
 * instead — see `compiledTypeBoxSchema`.
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
	): StaticDecode<TSchemaType> {
		return lankaValueOrThrow(runCompiled(schema, data), context);
	},

	validateSafe<TSchemaType extends TSchema>(
		schema: TSchemaType,
		data: unknown,
	): TLankaValidationResult<StaticDecode<TSchemaType>> {
		return runCompiled(schema, data);
	},
});

/**
 * One pass through the compiled checker, and a second only if the schema asks.
 *
 * Whether the schema has a codec at all is answered once per schema and cached
 * beside the checker, so the common schema — no codec — costs one generated
 * function call and nothing else.
 */
function runCompiled<TSchemaType extends TSchema>(
	schema: TSchemaType,
	data: unknown,
): TLankaValidationResult<StaticDecode<TSchemaType>> {
	if (!isTypeBoxSchema(schema)) throw notATypeBoxSchema(schema);

	const { check, codecs } = compiledTypeBoxSchema(schema);

	if (!check.Check(data)) return describeFailure(check.Errors(data));
	if (!codecs) return { success: true, data: data as StaticDecode<TSchemaType> };

	return decode(schema, data);
}

/**
 * Whether a value was built by TypeBox 1.x.
 *
 * Not `IsSchema`: that answers true for ANY object, because any object is a JSON
 * Schema — and `Compile` agrees, so a zod schema handed here would compile to a
 * checker that accepts everything. `~kind` is the mark every TypeBox builder
 * sets, as a non-enumerable own property, and it is what this reads.
 */
function isTypeBoxSchema(schema: unknown): schema is TSchema {
	if (typeof schema !== "object" || schema === null) return false;

	return typeof (schema as { "~kind"?: unknown })["~kind"] === "string";
}

/**
 * The refusal for a schema from another library.
 *
 * An application whose schemas come from two libraries eventually hands one to
 * the wrong validator. Unguarded, TypeBox 0.34's compiler threw
 * `TypeCompilerTypeGuardError: Preflight validation check failed` — accurate, and
 * useless to anyone who has not read TypeBox's source — and TypeBox 1.x would say
 * nothing at all. Either way, a raw library outcome escaped `validateSafe`.
 *
 * It throws from `validateSafe` too, deliberately: a refused VALUE is an outcome
 * a form renders, while a schema this package cannot read is a wiring mistake,
 * and putting it in `errors` would show a programmer's error to a user beside an
 * input.
 */
function notATypeBoxSchema(schema: unknown): LankaValidationError {
	return new LankaValidationError(
		lankaForeignSchemaMessage(schema, {
			lead: "This is not a TypeBox schema: it carries no `~kind`.",
		}),
		[],
	);
}

/**
 * The codec pass, for a schema that has one.
 *
 * `DecodeUnsafe` rather than `Decode`, because `Decode` is a pipeline — clone,
 * default, convert, CLEAN, check, decode — and two of those steps would make this
 * path disagree with the one without a codec: the check was already done, and
 * cleaning drops every property the schema did not name, which the path without
 * a codec keeps. `DecodeUnsafe` runs the decode functions and nothing else — and
 * writes their results into the object it is handed, so it is handed a copy: the
 * body is the caller's.
 *
 * A decode function is consumer code and may throw — a date that does not parse,
 * an enum with no case for the value. That is a refusal of the body, not a crash
 * of the validator, so it comes back as one: `validateSafe` promises to throw
 * nothing.
 */
function decode<TSchemaType extends TSchema>(
	schema: TSchemaType,
	data: unknown,
): TLankaValidationResult<StaticDecode<TSchemaType>> {
	try {
		return {
			success: true,
			data: DecodeUnsafe({}, schema, Clone(data)) as StaticDecode<TSchemaType>,
		};
	} catch (error) {
		const message = decodeFailureMessage(error);

		return { success: false, errors: [message], fields: [{ path: [], message }] };
	}
}

/**
 * What a failed decode should SAY.
 *
 * TypeBox 1.x rethrows whatever the decode function threw, unwrapped. An `Error`
 * has a message and a string is one; anything else has nothing to read, and
 * `String()` of it would put "undefined" or "[object Object]" in front of a user.
 */
function decodeFailureMessage(error: unknown): string {
	if (error instanceof Error) return error.message;
	if (typeof error === "string") return error;

	return "The schema's decode function refused the value without saying why.";
}

/** A TypeBox failure as the two lists the port promises: one for a banner, one for a form. */
function describeFailure<TOutput>(
	errors: readonly TLocalizedValidationError[],
): TLankaValidationResult<TOutput> {
	const fields = errors.map(toFieldError);

	return { success: false, errors: fields.map(describeField), fields };
}

function toFieldError(error: TLocalizedValidationError): ILankaFieldError {
	return { path: typeBoxPointerSegments(error.instancePath), message: error.message };
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
