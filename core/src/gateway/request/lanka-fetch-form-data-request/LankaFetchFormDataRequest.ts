import { ALankaTransportRequest } from "../_abstractions/lanka-transport-request/ALankaTransportRequest";
import type { ILankaTransportRequestConfig } from "../_abstractions/lanka-transport-request/ALankaTransportRequest";
import type { ILankaTransport } from "../../_interfaces/ILankaTransport";
import { LankaFetchFormDataTransport } from "../../transport/lanka-fetch-form-data-transport/LankaFetchFormDataTransport";

/**
 * The multipart request: hands the `Response` back untouched.
 *
 * Differs from `LankaFetchRequest` only in its transport — the one that must NOT
 * set `content-type`, because the browser writes it with the boundary and a
 * hand-set header leaves the body unparseable to the server.
 */
export class LankaFetchFormDataRequest<
	TOptions = RequestInit,
> extends ALankaTransportRequest<TOptions> {
	constructor(config: ILankaTransportRequestConfig<TOptions> = {}) {
		super(config, () => new LankaFetchFormDataTransport() as ILankaTransport<TOptions>);
	}

	protected parse<TReturn>(response: Response): Promise<TReturn> {
		return Promise.resolve(response as unknown as TReturn);
	}
}
