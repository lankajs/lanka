import type { TLankaExecuteOptions } from "../_types/TLankaExecuteOptions";
import type { ILankaValidator } from "../../validation/lanka-standard-validator/lankaStandardValidator";

/**
 * A gateway's protected surface, handed to whoever builds one by calling.
 *
 * The names match `ALankaGateway`'s protected members exactly, and that is the
 * parity contract: a consumer who switches styles moves the same call from
 * `this.endpoint(...)` to `endpoint(...)` and changes nothing else.
 */
export interface ILankaGatewayContext<TOptions> {
	/** The full URL for a path: base API, then this gateway's own base path. */
	endpoint: (path?: string) => string;

	/** Sends through this gateway's request, mock handler included. */
	request: <TReturn = unknown>(
		path: string,
		options?: TLankaExecuteOptions<TOptions>,
		mockHandler?: () => Promise<TReturn>,
	) => Promise<TReturn>;

	/** Serialises query parameters the way this gateway was configured to. */
	buildQueryParams: <T extends object>(params: T) => URLSearchParams;

	/** Checks a response body: the validator this gateway was given, or the Standard Schema port. */
	validationService: ILankaValidator;
}
