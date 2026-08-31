import type { ILankaTransport } from "../../_interfaces/ILankaTransport";

/**
 * HTTP Fetch FormData transport implementation.
 * Uses native fetch API optimized for FormData requests.
 * Does not set Content-Type header (browser will set it automatically with boundary).
 * For project-specific logic (auth, error handling, etc.), use `request` parameter
 * in Gateway config or create a custom transport.
 */
export class LankaFetchFormDataTransport implements ILankaTransport<RequestInit> {
	async request(resource: RequestInfo, options?: RequestInit): Promise<Response> {
		const formDataOptions: RequestInit = { ...options };

		// Remove Content-Type header if body is FormData (browser will set it with boundary)
		if (formDataOptions.body instanceof FormData && formDataOptions.headers) {
			const headers = new Headers(formDataOptions.headers);
			headers.delete("Content-Type");
			formDataOptions.headers = headers;
		}

		return await fetch(resource, formDataOptions);
	}
}
