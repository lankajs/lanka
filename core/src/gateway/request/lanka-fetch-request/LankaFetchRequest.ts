import { ALankaTransportRequest } from "../_abstractions/lanka-transport-request/ALankaTransportRequest";
import type { ILankaTransportRequestConfig } from "../_abstractions/lanka-transport-request/ALankaTransportRequest";
import type { TLankaRequestInit } from "../../_types/TLankaRequestInit";
import { LankaFetchTransport } from "../../lanka-fetch-transport/LankaFetchTransport";

/**
 * The raw request: hands the `Response` back untouched.
 *
 * The minimal, extensible case — a caller wanting headers, a stream, a blob or a
 * `204` reads them off the response itself. Multipart uploads come through here
 * too: the transport encodes by looking at the body, so posting a `FormData` and
 * posting an object are the same call.
 *
 * `TOptions` is CONSTRAINED to fetch options rather than merely defaulted to
 * them. A consumer widening it — their own `interface IRequestOptions extends
 * TLankaRequestInit` — still gets the shipped transport, because the constraint
 * is what lets the framework hand one over without a cast. Unconstrained, the
 * assignment did not typecheck and core cast its way past it; the cast worked
 * here and was unavailable to the consumer, who wrote a transport instead.
 */
export class LankaFetchRequest<
	TOptions extends TLankaRequestInit = TLankaRequestInit,
> extends ALankaTransportRequest<TOptions> {
	constructor(config: ILankaTransportRequestConfig<TOptions> = {}) {
		super(config, () => new LankaFetchTransport());
	}

	protected parse<TReturn>(response: Response): Promise<TReturn> {
		return Promise.resolve(response as unknown as TReturn);
	}
}
