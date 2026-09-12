import { ALankaGateway, LankaFetchJsonRequest } from "lanka/gateway";
import type { ILankaTransport } from "lanka/gateway";
import type { IPlaygroundOrder } from "../_interfaces/IPlaygroundOrder";

/**
 * An ordinary gateway that knows nothing about a cache.
 *
 * That is the arrangement this package exists to make possible: the gateway has
 * no memory, the cache has no wire, and a ViewModel holds both. A gateway that
 * cached would be the "second answer to one question" the canon refuses, and one
 * that knew about `queryKey` could not be reused by a screen without a cache.
 *
 * The `signal` travels as an ordinary request option, so the cache's
 * cancellation reaches the transport without either knowing about the other.
 */
export class PlaygroundOrderGateway extends ALankaGateway<RequestInit> {
	constructor(transport: ILankaTransport<RequestInit>) {
		super({ request: new LankaFetchJsonRequest({ transport }), basePath: "/orders" });
	}

	list(options: { signal?: AbortSignal } = {}): Promise<IPlaygroundOrder[]> {
		return this.requestExecutor.execute<IPlaygroundOrder[]>(this.endpoint(), options);
	}

	byId(id: number, options: { signal?: AbortSignal } = {}): Promise<IPlaygroundOrder> {
		return this.requestExecutor.execute<IPlaygroundOrder>(this.endpoint(String(id)), options);
	}

	rename(id: number, customer: string): Promise<IPlaygroundOrder> {
		return this.requestExecutor.execute<IPlaygroundOrder>(this.endpoint(String(id)), {
			method: "PUT",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ customer }),
		});
	}
}
