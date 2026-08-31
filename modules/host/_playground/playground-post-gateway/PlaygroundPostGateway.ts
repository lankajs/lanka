import { ALankaGateway, LankaFetchJsonRequest } from "lanka/gateway";
import type { ILankaTransport } from "lanka/gateway";
import type { IPlaygroundPost } from "../_interfaces/IPlaygroundPost";

/**
 * The one thing this scene asks of a server.
 *
 * A gateway and not a `fetch` in the scene, because the whole claim under test is
 * that the SAME gateway serves both sides: a loader on the server and a screen in
 * the browser.
 */
export class PlaygroundPostGateway extends ALankaGateway<RequestInit> {
	constructor(transport: ILankaTransport<RequestInit>) {
		super({ request: new LankaFetchJsonRequest({ transport }), basePath: "/posts" });
	}

	published(): Promise<IPlaygroundPost[]> {
		return this.requestExecutor.execute<IPlaygroundPost[]>(this.endpoint());
	}
}
