import { QueryClient } from "@tanstack/query-core";
import { createLanka } from "lanka/bootstrap";
import { lankaScenarioBootstrap } from "lanka/scenario";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { createLankaTanstackCache } from "../../src/index";
import { createPlaygroundOrdersVM } from "../create-playground-orders-vm/createPlaygroundOrdersVM";
import { PlaygroundOrderGateway } from "../playground-order-gateway/PlaygroundOrderGateway";
import type { ILankaInstance } from "lanka/bootstrap";
import type { ILankaReadCache } from "lanka/cache";
import type { ILankaTransport } from "lanka/gateway";

/** A started application: the instance to dispose, and the screens over one cache. */
export interface IPlaygroundApp {
	lanka: ILankaInstance;
	/** The application's own client, which anything else reading this cache must share. */
	client: QueryClient;
	/** The cache, resolved by NAME — a screen never learns which library answered. */
	cache: ILankaReadCache;
	useOrdersVM: ReturnType<typeof createPlaygroundOrdersVM>;
	/** A second screen over the SAME resource, which is what the cache is for. */
	useBadgeVM: ReturnType<typeof createPlaygroundOrdersVM>;
}

/**
 * The entry point, in the order an application's own must use.
 *
 * `registerInstance` rather than `register`: the client is a required
 * constructor parameter, so the locator cannot build the cache itself — and that
 * is deliberate. An application that also reads this cache from a component
 * must hand both halves the same `QueryClient`, and a default would let two
 * exist without anybody noticing until the first mutation.
 */
export const startPlayground = async (
	transport: ILankaTransport<RequestInit>,
	client: QueryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
): Promise<IPlaygroundApp> => {
	const lanka = createLanka({ host: lankaTestHost });
	lanka.activate();

	const orderGateway = new PlaygroundOrderGateway(transport);
	lanka.locators.singletons.registerInstance("ReadCache", createLankaTanstackCache(client));
	lanka.locators.gateways.registerInstance("PlaygroundOrderGateway", orderGateway);

	await lanka.bootstrap();
	lankaScenarioBootstrap.bootstrap();

	const cache = lanka.resolve<ILankaReadCache>("readCache");

	return {
		lanka,
		client,
		cache,
		useOrdersVM: createPlaygroundOrdersVM(orderGateway, cache),
		useBadgeVM: createPlaygroundOrdersVM(orderGateway, cache, "PlaygroundBadgeVM"),
	};
};
