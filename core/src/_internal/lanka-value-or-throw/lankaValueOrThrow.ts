import { LankaValidationError } from "../../validation/lanka-validation-error/LankaValidationError";
import type { TLankaValidationResult } from "../../validation/_types/TLankaValidationResult";

/**
 * The strict path, built from the safe one.
 *
 * `ILankaValidator` publishes two methods over one answer: `validateSafe`
 * returns an outcome, and `validate` is that outcome with the failure raised.
 * Every implementation of the port therefore writes the same five lines, and
 * three of them in this repository did — `check:composition` counted them.
 *
 * It is a GENERIC over the outcome rather than a helper returning `unknown`,
 * which is the whole reason it can be shared: `@lankajs/typebox` returns
 * `Static<TSchema>` and `@lankajs/effect` returns `Schema.Schema.Type<TAlias>`,
 * and a helper that erased those would have cost each package its inference —
 * a worse trade than the duplication it removed.
 *
 * `lanka/internal` because a sibling package needs it and must not reach into
 * core's `src/`. It promises nothing beyond a patch, which is right for five
 * lines that only restate what the port already says.
 */
export const lankaValueOrThrow = <TOutput>(
	result: TLankaValidationResult<TOutput>,
	context: string,
): TOutput => {
	if (result.success) return result.data;

	throw new LankaValidationError(
		`Validation failed for ${context}`,
		result.errors,
		result.fields,
	);
};
