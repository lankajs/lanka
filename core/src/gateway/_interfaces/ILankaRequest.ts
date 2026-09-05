import type { TLankaRequestInit } from "../_types/TLankaRequestInit";
import type { TLankaExecuteOptions } from "../_types/TLankaExecuteOptions";

/**
 * What a gateway needs of a request: one method that sends and returns a value.
 *
 * The port, so a consumer can supply their OWN request rather than inheriting
 * from ours. `ALankaRequest` implements it and remains the convenient way in —
 * it brings middleware composition, deadline resolution, in-flight accounting
 * and failure classification — but a consumer with a different transport story
 * (a native bridge, an offline queue, a test double that never touches the
 * network) needs none of that and should not have to extend a class to be
 * accepted.
 *
 * `mockHandler` is part of the contract rather than an implementation detail: it
 * is how development without a backend works, and a request that ignored it
 * would silently disable mock mode for the gateway holding it.
 */
export interface ILankaRequest<TOptions = TLankaRequestInit> {
	/**
	 * Sends the request and returns the value the caller asked for.
	 *
	 * Rejects with a `LankaError` carrying a kind — `http`, `network`, `timeout`,
	 * `aborted`, `schema` — because the kind is what a caller branches on: a
	 * timeout is shown, a cancellation is not, and only a network failure invites
	 * a retry.
	 */
	execute<TReturn = Response>(
		endpoint: string,
		options?: TLankaExecuteOptions<TOptions>,
		mockHandler?: () => Promise<TReturn>,
	): Promise<TReturn>;
}
