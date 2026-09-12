import { LankaError } from "../../errors/lanka-error/LankaError";
import type { ILankaFieldError } from "../../errors/_interfaces/ILankaFieldError";

/**
 * The validation port's failure: a body the schema refused.
 *
 * A `LankaError` of kind `schema`, so that `LankaError.is` and everything built
 * on it — the HTTP policy's error middleware, an application branching on
 * `kind` — see a refused body the way they see the request layer's own
 * "200 that was not JSON". It used to extend `Error` directly, and a consumer
 * that told a contract drift from a network failure by `kind` never saw it.
 *
 * `name` stays `LankaValidationError` and `status` stays 422: both are what a
 * consumer's existing `catch` reads, and the message list is `errors`. The same
 * issues arrive a second time as `fields`, with the path in segments, for the
 * consumer that has an input to show each one at.
 */
export class LankaValidationError extends LankaError {
	constructor(message: string, errors: string[] = [], fields: readonly ILankaFieldError[] = []) {
		super({
			kind: "schema",
			message,
			status: 422,
			issues: errors.length > 0 ? errors : [message],
			fields: fields.length > 0 ? fields : undefined,
		});
		this.name = "LankaValidationError";
		Object.setPrototypeOf(this, LankaValidationError.prototype);
	}

	/** Always present here, unlike the base's optional list. */
	override get errors(): string[] {
		return [...(this.issues ?? [])];
	}
}
