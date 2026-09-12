import { ALankaGateway, LankaFetchJsonRequest } from "lanka/gateway";
import type { ILankaTransport } from "lanka/gateway";
import type { IPlaygroundArticle } from "../_interfaces/IPlaygroundArticle";

/**
 * An ordinary gateway that knows nothing about a cache.
 *
 * It takes an optional `signal` like every other gateway, and this member never
 * passes one: `@nanostores/query` hands its fetcher only the key parts. That is
 * the whole reason `cancel` is optional on the port, and the reason the
 * parameter is optional in `load`'s signature — the gateway is written the same
 * way for both members.
 */
export class PlaygroundArticleGateway extends ALankaGateway<RequestInit> {
	constructor(transport: ILankaTransport<RequestInit>) {
		super({ request: new LankaFetchJsonRequest({ transport }), basePath: "/articles" });
	}

	bySlug(slug: string, options: { signal?: AbortSignal } = {}): Promise<IPlaygroundArticle> {
		return this.requestExecutor.execute<IPlaygroundArticle>(this.endpoint(slug), options);
	}
}
