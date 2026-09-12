import { createLanka } from "../../src/bootstrap/index";
import { lankaScenarioBootstrap } from "../../src/scenario/index";
import { createPlaygroundLazyOrdersVM } from "../create-playground-lazy-orders-vm/createPlaygroundLazyOrdersVM";
import { createPlaygroundOrderEditVM } from "../create-playground-order-edit-vm/createPlaygroundOrderEditVM";
import { createPlaygroundOrdersVM } from "../create-playground-orders-vm/createPlaygroundOrdersVM";
import { createPlaygroundRenameVM } from "../create-playground-rename-vm/createPlaygroundRenameVM";
import { PlaygroundOrderGateway } from "../playground-order-gateway/PlaygroundOrderGateway";
import { PlaygroundReadCache } from "../playground-read-cache/PlaygroundReadCache";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import type { ALankaSingleton } from "../../src/locator/index";
import type { ILankaInstance } from "../../src/bootstrap/index";
import type { ILankaTransport } from "../../src/gateway/index";
import type { IPlaygroundReadCache } from "../_interfaces/IPlaygroundReadCache";

/** A read cache the locator can build: the `Map` one, or the one over TanStack Query. */
export type TPlaygroundReadCacheClass = new () => ALankaSingleton & IPlaygroundReadCache;

/** The order application, started: one instance, one cache, the four configurations. */
export interface IPlaygroundOrderApp {
	lanka: ILankaInstance;
	/** The one cache, resolved by name the way a screen would. */
	cache: IPlaygroundReadCache;
	/** The gateway, for a screen that reads the resource with a query hook of its own. */
	orderGateway: PlaygroundOrderGateway;
	/** Only lanka: the inputs are state. */
	useRenameVM: ReturnType<typeof createPlaygroundRenameVM>;
	/** lanka and a form: the form owns the inputs, the ViewModel the rest. */
	useEditVM: ReturnType<typeof createPlaygroundOrderEditVM>;
	/** lanka and a cache: a reader, hearing the resource through the cache. */
	useOrdersVM: ReturnType<typeof createPlaygroundOrdersVM>;
	/** A second reader of the same resource — the reason a cache is there. */
	useSecondOrdersVM: ReturnType<typeof createPlaygroundOrdersVM>;
	/** The same reader, built on first use and released on dispose. */
	useLazyOrdersVM: ReturnType<typeof createPlaygroundLazyOrdersVM>;
	/** All three: form above, cache below, the ViewModel between. */
	useCachedEditVM: ReturnType<typeof createPlaygroundOrderEditVM>;
}

/**
 * The entry point of the order application, in the order an application's own
 * must use: activate, register what the locator will be asked for, bootstrap,
 * then build the ViewModels — so a ViewModel with `onInit` and no scenarios is
 * attached and initialised the moment it is built.
 *
 * The cache is a SINGLETON in the locator because that is what it is to an
 * application: one QueryClient, reached by name, replaced by name in a test —
 * which is exactly what the second parameter does.
 */
export const startOrderPlayground = async (
	transport: ILankaTransport<RequestInit>,
	options: { cache?: TPlaygroundReadCacheClass } = {},
): Promise<IPlaygroundOrderApp> => {
	const lanka = createLanka({ host: lankaTestHost });
	lanka.activate();

	const orderGateway = new PlaygroundOrderGateway(transport);
	lanka.locators.singletons.register("PlaygroundReadCache", options.cache ?? PlaygroundReadCache);
	lanka.locators.gateways.registerInstance("PlaygroundOrderGateway", orderGateway);

	await lanka.bootstrap();
	lankaScenarioBootstrap.bootstrap();

	const cache = lanka.resolve<IPlaygroundReadCache>("playgroundReadCache");

	return {
		lanka,
		cache,
		orderGateway,
		useRenameVM: createPlaygroundRenameVM(orderGateway),
		useEditVM: createPlaygroundOrderEditVM(orderGateway),
		useOrdersVM: createPlaygroundOrdersVM(orderGateway, cache),
		useSecondOrdersVM: createPlaygroundOrdersVM(orderGateway, cache, "PlaygroundOrdersBadgeVM"),
		useLazyOrdersVM: createPlaygroundLazyOrdersVM(orderGateway, cache),
		useCachedEditVM: createPlaygroundOrderEditVM(orderGateway, cache),
	};
};
