import type { TLankaValidationResult } from "lanka/validation";

/**
 * A vendor validator, as this package needs to call it.
 *
 * The schema parameter is `never` and that is the sound choice rather than a
 * trick: every vendor validator declares a schema type of its own —
 * `TLankaSchema`, a TypeBox `TSchema`, an Effect schema — and a parameter is
 * assignable in the opposite direction to a return. `never` is assignable to all
 * of them, so all of them are assignable here, and this package needs no import
 * from any of the six.
 *
 * The hub checks the dialect BEFORE it calls, so the schema reaching a validator
 * is one that validator recognises. If the two ever disagree, the vendor
 * package's own guard refuses loudly — which is the behaviour worth having, and
 * the family playground asserts the two never disagree.
 */
export interface ILankaDialectValidator {
	validate(schema: never, data: unknown, context: string): unknown;
	validateSafe(schema: never, data: unknown): TLankaValidationResult<unknown>;
}
