import { LankaFetchRequest } from "../../lanka-fetch-request/LankaFetchRequest";
import type { ILankaTransportRequestConfig } from "../../_abstractions/lanka-transport-request/ALankaTransportRequest";

/**
 * The functional style of `LankaFetchRequest`: the raw `Response`, for a download or a stream.
 *
 * One line, and that is the point — the factory IS the class, so a behaviour
 * cannot exist in one style and not the other.
 */
export const createLankaFetchRequest = <TOptions = RequestInit>(
	config: ILankaTransportRequestConfig<TOptions> = {},
): LankaFetchRequest<TOptions> => new LankaFetchRequest<TOptions>(config);
