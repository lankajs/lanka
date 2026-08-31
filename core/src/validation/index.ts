/**
 * The response body validation port.
 *
 * Accepts ANY schema implementing Standard Schema: zod 4, valibot, arktype. An
 * abstraction typed by its single implementation is not an abstraction; the
 * proof otherwise is a second implementation passing the same assertions, and it
 * is in `lankaStandardValidator.test.ts`.
 *
 * There are no adapter classes: a schema describes itself, and a per-library
 * adapter was a consequence of the port speaking one language.
 *
 * ## Mapping is a schema, not a layer
 *
 * A server whose shape is not the application's is handled by a TRANSFORMING
 * schema, because `validate` returns what the schema produced — reading the wire
 * and building a domain object is one call. An `adapt(schema, data)` beside
 * `validate(schema, data)` would be a second name for it.
 *
 * Two schemas, though, not one: the mapping changes when the SERVER changes, the
 * check when the APPLICATION does, and each names its own context so a failure
 * says which of the two contracts broke. The worked example is the core
 * playground's `listFromLegacyApi`; both validator packages carry the same scene
 * in their own library's syntax, including the reverse direction — the payload a
 * backend expects back is a mapping like any other.
 */

export { lankaStandardValidator } from "./lanka-standard-validator/lankaStandardValidator";
export type {
	ILankaValidator,
	TLankaSchema,
} from "./lanka-standard-validator/lankaStandardValidator";
export { LankaValidationError } from "./lanka-validation-error/LankaValidationError";
export type { TLankaValidationResult } from "./_types/TLankaValidationResult";
