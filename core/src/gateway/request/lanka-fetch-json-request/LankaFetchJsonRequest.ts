import { ALankaTransportRequest } from "../_abstractions/lanka-transport-request/ALankaTransportRequest";
import type { ILankaTransportRequestConfig } from "../_abstractions/lanka-transport-request/ALankaTransportRequest";
import type { ILankaTransport } from "../../_interfaces/ILankaTransport";
import { LankaFetchJsonTransport } from "../../transport/lanka-fetch-json-transport/LankaFetchJsonTransport";
import { LankaError } from "../../../errors/lanka-error/LankaError";

/** The JSON request: parses the body, and refuses a body that is not JSON. */
/**
 * A request kind that answers a parsed JSON body — what most endpoints return.
 *
 * A gateway holds one, and is handed it rather than constructing it, which is
 * what lets a test give the same gateway a transport that never leaves the
 * process. `createLankaFetchJsonRequest()` builds the same class.
 */
export class LankaFetchJsonRequest<
	TOptions = RequestInit,
> extends ALankaTransportRequest<TOptions> {
	constructor(config: ILankaTransportRequestConfig<TOptions> = {}) {
		super(config, () => new LankaFetchJsonTransport() as ILankaTransport<TOptions>);
	}

	/**
	 * Parses the body, or names the failure.
	 *
	 * The content type is read for the ERROR MESSAGE only. Using it to choose
	 * between two parse paths, where the second answers `{}` for any non-empty
	 * body it cannot parse, fails silently: the caller's schema is the first thing
	 * to notice, and the caller's SCREEN is where it shows up.
	 *
	 * A measured case: a dev server whose `/api` fell through to the SPA fallback
	 * answered `200 text/html` with `index.html`. Turned into `{}`, the schema
	 * refused it and a person read a validator's issue list on the sign-in card. A
	 * body a JSON transport cannot parse is never a value — it is a misrouted
	 * request, and saying so names the actual failure.
	 */
	protected async parse<TReturn>(response: Response): Promise<TReturn> {
		const contentType = response.headers.get("content-type");

		const text = await response.text();
		if (!text) {
			return undefined as TReturn;
		}

		try {
			return JSON.parse(text) as TReturn;
		} catch (error) {
			// `schema`, not `network`: the request arrived, the server answered, and
			// the answer was the wrong shape. Not cosmetic — a network failure
			// invites a retry, while retrying a broken contract is pointless and
			// blaming the user for it more so.
			throw new LankaError({
				kind: "schema",
				message:
					`Failed to parse JSON response (content-type: ${contentType ?? "none"}): ` +
					`${error instanceof Error ? error.message : String(error)}`,
				cause: error,
			});
		}
	}
}
