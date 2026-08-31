import type { ILankaTransport } from "../../_interfaces/ILankaTransport";

/**
 * HTTP Fetch transport implementation.
 * Uses native fetch API without any project-specific decorators.
 * For project-specific logic (auth, error handling, etc.), use `request` parameter
 * in Gateway config or create a custom transport.
 */
export class LankaFetchTransport implements ILankaTransport<RequestInit> {
	async request(resource: RequestInfo, options?: RequestInit): Promise<Response> {
		return await fetch(resource, options);
	}
}
