import type { ILankaFieldError } from "../../errors/_interfaces/ILankaFieldError";

/**
 * What `validateSafe` answers.
 *
 * On failure, `errors` is the banner's list and `fields` the form's: the same
 * issues, joined into text and kept in segments. `fields` is optional because
 * `ILankaValidator` is a port a consumer may implement, and a port that grows a
 * required member breaks every implementation it did not write.
 */
export type TLankaValidationResult<T> =
	| { success: true; data: T }
	| { success: false; errors: string[]; fields?: readonly ILankaFieldError[] };
