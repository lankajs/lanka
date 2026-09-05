import { ALankaGateway, LankaFetchJsonRequest } from "lanka/gateway";
import type { ILankaTransport } from "lanka/gateway";

/** Something for the wire to carry, so the inspector has a request to time. */
export class PlaygroundCartGateway extends ALankaGateway<RequestInit> {
	constructor(transport: ILankaTransport<RequestInit>) {
		super({ request: new LankaFetchJsonRequest({ transport }), basePath: "/cart" });
	}

	load(): Promise<{ items: number }> {
		return this.requestExecutor.execute<{ items: number }>(this.endpoint());
	}
}
