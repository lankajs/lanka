import { ALankaTransportRequest } from "../_abstractions/lanka-transport-request/ALankaTransportRequest";
import type { ILankaTransportRequestConfig } from "../_abstractions/lanka-transport-request/ALankaTransportRequest";
import type { ILankaTransport } from "../../_interfaces/ILankaTransport";
import { LankaFetchTransport } from "../../transport/lanka-fetch-transport/LankaFetchTransport";

/**
 * The raw request: hands the `Response` back untouched.
 *
 * The minimal, extensible case — a caller wanting headers, a stream or a blob
 * reads them off the response itself.
 */
export class LankaFetchRequest<TOptions = RequestInit> extends ALankaTransportRequest<TOptions> {
	constructor(config: ILankaTransportRequestConfig<TOptions> = {}) {
		super(config, () => new LankaFetchTransport() as ILankaTransport<TOptions>);
	}

	protected parse<TReturn>(response: Response): Promise<TReturn> {
		return Promise.resolve(response as unknown as TReturn);
	}
}
