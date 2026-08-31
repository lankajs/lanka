/**
 * Structural API-error shape read by consumer code.
 *
 * `status` is OPTIONAL: a network drop and an aborted request carry no status,
 * and three of the six `LankaError` kinds have none.
 *
 * `LankaError` implements this interface, so consumers may read `status` and
 * `errors` off any thrown framework error.
 */
export interface ILankaApiError {
	status?: number;
	errors?: string[];
	message?: string;
}
