import { ILankaApiError } from "../../errors/_interfaces/ILankaApiError";

/**
 * What a schema refused, as an error a screen can catch by type.
 *
 * The one case where a class is the answer by itself: `instanceof` needs a
 * prototype. It carries the field errors a form renders, so a caller branches on
 * the type rather than parsing a message.
 */
export class LankaValidationError extends Error implements ILankaApiError {
	status: number;
	errors: string[];

	constructor(message: string, errors: string[] = []) {
		super(message);
		this.name = "LankaValidationError";
		this.status = 422;
		this.errors = errors.length > 0 ? errors : [message];
	}
}
