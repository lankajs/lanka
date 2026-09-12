import { lankaStandardValidator } from "lanka/validation";
import type { Schema } from "effect";
import type { TLankaValidationResult } from "lanka/validation";
import { standardEffectSchema } from "../_internal/standard-effect-schema/standardEffectSchema";

/**
 * The validator's shape, typed by an Effect schema rather than by core's port.
 *
 * `ILankaValidator` takes a `TLankaSchema` — a Standard Schema — and an Effect
 * schema is not one until `Schema.standardSchemaV1` makes it one. A validator
 * declared as the port would therefore reject every schema a consumer of this
 * package has. The SHAPE is the port's, member for member, and `check:family`
 * holds the barrel to the family's surface; what differs is the one type the
 * library makes impossible to share.
 */
export interface ILankaEffectValidator {
	/** Validates and returns the parsed value, or throws. */
	validate<TAlias extends Schema.Schema.AnyNoContext>(
		schema: TAlias,
		data: unknown,
		context: string,
	): Schema.Schema.Type<TAlias>;
	/** Validates and returns an outcome, throwing nothing. */
	validateSafe<TAlias extends Schema.Schema.AnyNoContext>(
		schema: TAlias,
		data: unknown,
	): TLankaValidationResult<Schema.Schema.Type<TAlias>>;
}

/**
 * The validator for Effect schemas.
 *
 * ## What it adds, and what it deliberately does not
 *
 * One thing: it holds the Standard Schema wrapper still. Effect implements the
 * specification through `Schema.standardSchemaV1(schema)`, which builds a new
 * object per call; cached per schema, the port sees one wrapper for the life of
 * the schema and everything else is core's.
 *
 * Everything else is absent on purpose. No Effect runtime, no `Effect.runSync`,
 * no error channel: an application using Effect already has a runtime, and a
 * second one started inside a validator is a second one to reason about. This
 * package binds one port.
 *
 * Declare schemas at module level. One built inside a component body is a new
 * object on every render, and therefore a new cache key.
 */
export const lankaEffectValidator: ILankaEffectValidator = Object.freeze<ILankaEffectValidator>({
	validate<TAlias extends Schema.Schema.AnyNoContext>(
		schema: TAlias,
		data: unknown,
		context: string,
	): Schema.Schema.Type<TAlias> {
		return lankaStandardValidator.validate(
			standardEffectSchema(schema),
			data,
			context,
		) as Schema.Schema.Type<TAlias>;
	},

	validateSafe<TAlias extends Schema.Schema.AnyNoContext>(
		schema: TAlias,
		data: unknown,
	): TLankaValidationResult<Schema.Schema.Type<TAlias>> {
		return lankaStandardValidator.validateSafe(
			standardEffectSchema(schema),
			data,
		) as TLankaValidationResult<Schema.Schema.Type<TAlias>>;
	},
});
