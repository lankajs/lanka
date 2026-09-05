import { LankaFetchJsonRequest } from "../../lanka-fetch-json-request/LankaFetchJsonRequest";
import type { ILankaTransportRequestConfig } from "../../_abstractions/lanka-transport-request/ALankaTransportRequest";
import type { TLankaRequestInit } from "../../../_types/TLankaRequestInit";

/**
 * The functional style of `LankaFetchJsonRequest`: a JSON body, which is what most endpoints answer.
 *
 * One line, and that is the point — the factory IS the class, so a behaviour
 * cannot exist in one style and not the other.
 */
export const createLankaFetchJsonRequest = <TOptions extends TLankaRequestInit = TLankaRequestInit>(
	config: ILankaTransportRequestConfig<TOptions> = {},
): LankaFetchJsonRequest<TOptions> => new LankaFetchJsonRequest<TOptions>(config);
