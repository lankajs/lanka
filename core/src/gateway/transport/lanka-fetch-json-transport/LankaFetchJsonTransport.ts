import type { ILankaTransport } from "../../_interfaces/ILankaTransport";

/**
 * HTTP Fetch JSON transport implementation.
 * Uses native fetch API with JSON-specific headers.
 * Automatically sets Content-Type to application/json for requests with body.
 * For project-specific logic (auth, error handling, etc.), use `request` parameter
 * in Gateway config or create a custom transport.
 */
export class LankaFetchJsonTransport implements ILankaTransport<RequestInit> {
	async request(resource: RequestInfo, options?: RequestInit): Promise<Response> {
		// Only set Content-Type if body exists and is not FormData
		if (options?.body && !(options.body instanceof FormData)) {
			const headers = new Headers(options.headers);

			// If body is object, stringify it
			let body = options.body;
			if (
				typeof body === "object" &&
				!(body instanceof FormData) &&
				!(body instanceof Blob)
			) {
				body = JSON.stringify(body);
			}

			headers.set("Content-Type", "application/json");

			return await fetch(resource, {
				...options,
				headers,
				body,
			});
		}

		// No body or FormData - use options as-is
		return await fetch(resource, options);
	}
}
