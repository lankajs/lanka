import { Schema } from "effect";
import { LankaValidationError } from "lanka/validation";
import type { StandardSchemaV1 } from "@standard-schema/spec";

/**
 * The Standard Schema view of an Effect schema, built at most once.
 *
 * ## Why this exists
 *
 * An Effect schema carries no `~standard` of its own; `Schema.standardSchemaV1`
 * BUILDS one. Two calls with the same schema return two different objects —
 * measured, not assumed — so handing the port a fresh wrapper on every
 * validation would allocate one per call and re-do the schema's own preparation
 * with it.
 *
 * ## Why a WeakMap
 *
 * The key is the CONSUMER'S schema object. A strong map would keep every schema
 * any screen ever built alive for the life of the tab — a leak the consumer
 * cannot see, cannot measure and cannot clear. Weak, the entry goes when the
 * schema does.
 *
 * A schema rebuilt on every render defeats the cache, because it is a new key
 * each time. Declare schemas at module level, which is where they belong anyway.
 *
 * ## Why `AnyNoContext` and not `Any`
 *
 * `Schema.standardSchemaV1` accepts only a schema whose `Context` is `never` — one
 * that needs no services to decode. That is not a limitation to work around: a
 * schema requiring a service can only be run by an Effect runtime, and this
 * package starts none on purpose. The type says so at the boundary rather than
 * letting the call fail somewhere further in.
 */
const wrappers = new WeakMap<object, StandardSchemaV1<unknown, unknown>>();

export const standardEffectSchema = (
	schema: Schema.Schema.AnyNoContext,
): StandardSchemaV1<unknown, unknown> => {
	if (!Schema.isSchema(schema)) throw notAnEffectSchema(schema);

	const known = wrappers.get(schema);
	if (known) return known;

	const fresh = Schema.standardSchemaV1(schema) as StandardSchemaV1<unknown, unknown>;

	wrappers.set(schema, fresh);

	return fresh;
};

/**
 * The refusal for a schema from another library.
 *
 * An application whose schemas come from two libraries eventually hands one to
 * the wrong validator. Unguarded, `Schema.standardSchemaV1` was handed a zod
 * schema and threw "Cannot read properties of undefined (reading '_tag')" from
 * inside Effect — an error naming neither library, escaping `validateSafe` as a
 * raw `TypeError` when that method promises to throw nothing.
 *
 * `Schema.isSchema` is Effect's own answer, so the guard cannot drift from what
 * `standardSchemaV1` will accept.
 *
 * It throws from `validateSafe` too, deliberately: a refused VALUE is an outcome
 * a form renders, while a schema this package cannot read is a wiring mistake,
 * and putting it in `errors` would show a programmer's error to a user beside an
 * input.
 */
function notAnEffectSchema(schema: unknown): LankaValidationError {
	const standard =
		(typeof schema === "object" || typeof schema === "function") &&
		schema !== null &&
		"~standard" in schema;

	return new LankaValidationError(
		"This is not an Effect schema. " +
			(standard
				? "It does carry `~standard`, so it belongs to another library in " +
					"`modules/validators/` — validate it with that package's validator, or with " +
					"`lankaStandardValidator`."
				: "Either it is not a schema at all, or it belongs to a library with its own " +
					"package in `modules/validators/`."),
		[],
	);
}
