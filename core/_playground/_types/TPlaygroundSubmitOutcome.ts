import type { ILankaFieldError } from "../../src/errors/index";

/**
 * What a submit action answers the form.
 *
 * Never a `LankaError`: the form does not know what a transport is. Failures
 * with an address come back as `fields`; a refusal with no address comes back as
 * `message` for the form's root; and everything that is the SCREEN'S — a dropped
 * link, a 500, a broken contract — has already been written into the
 * ViewModel's state by the time this is returned, so the form sees an empty
 * failure and does nothing.
 */
export type TPlaygroundSubmitOutcome<TData> =
	{ readonly ok: true; readonly data: TData } | TPlaygroundSubmitFailure;

/** The failing half alone — what the failure sorter answers, whatever was being saved. */
export type TPlaygroundSubmitFailure = {
	readonly ok: false;
	readonly fields: readonly ILankaFieldError[];
	readonly message?: string;
};
