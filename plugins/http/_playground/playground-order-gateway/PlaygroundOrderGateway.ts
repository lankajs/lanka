import { ALankaGateway, LankaFetchJsonRequest } from "lanka/gateway";
import type { ILankaTransport } from "lanka/gateway";

/**
 * An ordinary gateway that knows nothing about the policy above it.
 *
 * That is the package's whole claim: one unsafe method and one safe one, written
 * as if no CSRF header, idempotency key, retry or deadline existed.
 */
export class PlaygroundOrderGateway extends ALankaGateway<RequestInit> {
	constructor(transport: ILankaTransport<RequestInit>) {
		super({ request: new LankaFetchJsonRequest({ transport }), basePath: "/orders" });
	}

	place(): Promise<{ ok: boolean }> {
		return this.requestExecutor.execute<{ ok: boolean }>(this.endpoint(), { method: "POST" });
	}

	read(): Promise<{ ok: boolean }> {
		return this.requestExecutor.execute<{ ok: boolean }>(this.endpoint());
	}
}
