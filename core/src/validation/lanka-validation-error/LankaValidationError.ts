import { LankaError } from "../../errors/lanka-error/LankaError";

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
 * consumer's existing `catch` reads, and the message list is `errors`.
 */
export class LankaValidationError extends LankaError {
	constructor(message: string, errors: string[] = []) {
		super({
			kind: "schema",
			message,
			status: 422,
			issues: errors.length > 0 ? errors : [message],
		});
		this.name = "LankaValidationError";
		Object.setPrototypeOf(this, LankaValidationError.prototype);
	}

	/** Always present here, unlike the base's optional list. */
	override get errors(): string[] {
		return [...(this.issues ?? [])];
	}
}
