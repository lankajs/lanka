import type { ILankaFieldError } from "lanka/errors";

/**
 * What a submit action answers the form.
 *
 * Never a `LankaError`: a form does not know what a transport is. Failures with
 * an address come back as `fields`; a refusal with no address comes back as
 * `message` for the form's root; and everything that is the SCREEN's has already
 * been written into the ViewModel's state by the time this is returned.
 */
export type TPlaygroundSubmitOutcome<TData> =
	{ readonly ok: true; readonly data: TData } | TPlaygroundSubmitFailure;

/** The failing half alone, whatever was being saved. */
export type TPlaygroundSubmitFailure = {
	readonly ok: false;
	readonly fields: readonly ILankaFieldError[];
	readonly message?: string;
};
