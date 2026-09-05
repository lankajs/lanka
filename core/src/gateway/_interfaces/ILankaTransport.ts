import type { TLankaRequestInit } from "../_types/TLankaRequestInit";

/**
 * How bytes travel. The seam a consumer replaces to change the PROTOCOL.
 *
 * `LankaFetchTransport` is the only implementation core ships, and one is the
 * right number: HTTP over `fetch` is what almost every application does, and the
 * things that once justified a second and a third — a JSON `content-type`, a
 * multipart one — turned out to be encodings rather than protocols. An encoding
 * belongs to the CALL, and the shipped transport reads the body to decide it.
 *
 * Implement this for something genuinely different: a native bridge, a socket, an
 * offline queue, a double that never leaves the process. Anything that still ends
 * in `fetch` and only wants to add a header, a credential, a retry or a refresh
 * is POLICY — write a `TLankaRequestMiddleware` and register it with
 * `useRequestMiddleware`, or reach for `@lankajs/plugin-http`, which already has
 * all four. A transport rewritten to carry policy is how an application ends up
 * maintaining its own copy of this package.
 */
export interface ILankaTransport<TOptions = TLankaRequestInit> {
	/**
	 * Executes a request and returns a Response.
	 * @param resource - Request resource (URL or Request object)
	 * @param options - Request options specific to transport implementation
	 * @returns Promise resolving to Response
	 */
	request(resource: RequestInfo, options?: TOptions): Promise<Response>;
}
