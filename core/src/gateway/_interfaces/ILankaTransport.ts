/**
 * Transport layer interface for Gateway.
 * Allows to swap between different communication protocols (HTTP Fetch, gRPC, WebSocket, etc.)
 */
export interface ILankaTransport<TOptions = RequestInit> {
	/**
	 * Executes a request and returns a Response.
	 * @param resource - Request resource (URL or Request object)
	 * @param options - Request options specific to transport implementation
	 * @returns Promise resolving to Response
	 */
	request(resource: RequestInfo, options?: TOptions): Promise<Response>;
}
