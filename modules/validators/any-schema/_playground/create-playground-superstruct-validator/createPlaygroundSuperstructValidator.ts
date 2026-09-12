import { Struct, StructError, validate as superstructValidate } from "superstruct";
import { lankaValueOrThrow } from "lanka/internal";
import type { TLankaValidationResult } from "lanka/validation";

/**
 * What an application writes to teach the hub a library lanka has never heard of.
 *
 * Forty lines, and every one of them is a decision the six shipped packages make
 * too: which shape counts as a schema, what a refusal looks like, and what
 * happens to a schema from somewhere else.
 *
 * It lives in the playground rather than in `src/` on purpose. Shipping it would
 * make superstruct a dependency of a package whose whole claim is that it has
 * none — and it would be the seventh vendor package written by the wrong people.
 * An application that needs one writes this; a library popular enough to deserve
 * better gets a package of its own in `modules/validators/`.
 */
export const createPlaygroundSuperstructValidator = () => ({
	// `lankaValueOrThrow` is `lanka/internal` — the tier that exists so a sibling
	// need not copy five lines. An application writing its own dialect gets the
	// same help the shipped packages get, which is the point of publishing it.
	validate: (schema: never, data: unknown, context: string): unknown =>
		lankaValueOrThrow(run(schema, data), context),

	validateSafe(schema: never, data: unknown): TLankaValidationResult<unknown> {
		return run(schema, data);
	},
});

/**
 * One pass, with every failing field rather than the first.
 *
 * superstruct answers with a tuple — `[error, value]` — and never throws, which
 * makes it the easiest of the seven to bridge. `coerce: true` is deliberate: the
 * port promises what the SCHEMA produced, and a library that can cast should.
 */
function run(schema: never, data: unknown): TLankaValidationResult<unknown> {
	const [error, value] = superstructValidate(data, schema as unknown as Struct<unknown>, {
		coerce: true,
	});

	if (!error) return { success: true, data: value };

	const fields = failuresOf(error).map((failure) => ({
		path: [...failure.path],
		message: failure.message,
	}));

	return {
		success: false,
		errors: fields.map((field) =>
			field.path.length > 0 ? `${field.path.join(".")}: ${field.message}` : field.message,
		),
		fields,
	};
}

/** Every failure superstruct found, which is a generator rather than a list. */
function failuresOf(error: StructError): { path: (string | number)[]; message: string }[] {
	return [...error.failures()].map((failure) => ({
		path: failure.path as (string | number)[],
		message: failure.message,
	}));
}
