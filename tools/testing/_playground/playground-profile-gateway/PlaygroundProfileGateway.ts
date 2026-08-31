import { ALankaGateway, LankaFetchJsonRequest } from "lanka/gateway";
import type { ILankaTransport } from "lanka/gateway";
import type { IPlaygroundProfile } from "../_interfaces/IPlaygroundProfile";

/**
 * An ordinary gateway, written without a thought for how it will be tested.
 *
 * That is the fixture's job here: the kit's claim is that testing code like this
 * costs a consumer nothing, and code written to be easy to test would prove the
 * claim about itself instead.
 */
export class PlaygroundProfileGateway extends ALankaGateway<RequestInit> {
	constructor(transport: ILankaTransport<RequestInit>) {
		super({ request: new LankaFetchJsonRequest({ transport }), basePath: "/profile" });
	}

	load(): Promise<IPlaygroundProfile> {
		return this.requestExecutor.execute<IPlaygroundProfile>(this.endpoint());
	}
}
