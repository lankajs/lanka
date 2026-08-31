import { LankaFetchFormDataRequest } from "../../lanka-fetch-form-data-request/LankaFetchFormDataRequest";
import type { ILankaTransportRequestConfig } from "../../_abstractions/lanka-transport-request/ALankaTransportRequest";

/**
 * The functional style of `LankaFetchFormDataRequest`: a multipart body, for an upload.
 *
 * One line, and that is the point — the factory IS the class, so a behaviour
 * cannot exist in one style and not the other.
 */
export const createLankaFetchFormDataRequest = <TOptions = RequestInit>(
	config: ILankaTransportRequestConfig<TOptions> = {},
): LankaFetchFormDataRequest<TOptions> => new LankaFetchFormDataRequest<TOptions>(config);
