import { nanoquery } from "@nanostores/query";
import { createLanka } from "lanka/bootstrap";
import { lankaScenarioBootstrap } from "lanka/scenario";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { createLankaNanostoresCache } from "../../src/index";
import { createPlaygroundArticleVM } from "../create-playground-article-vm/createPlaygroundArticleVM";
import { PlaygroundArticleGateway } from "../playground-article-gateway/PlaygroundArticleGateway";
import type { ILankaInstance } from "lanka/bootstrap";
import type { ILankaReadCache } from "lanka/cache";
import type { ILankaTransport } from "lanka/gateway";
import type { TLankaNanostoresClient } from "../../src/index";

/** A started application: the instance to dispose, and two screens over one cache. */
export interface IPlaygroundApp {
	lanka: ILankaInstance;
	/** The cache, resolved by NAME — a screen never learns which library answered. */
	cache: ILankaReadCache;
	useArticleVM: ReturnType<typeof createPlaygroundArticleVM>;
	/** A second reader of the same article, which is what makes a change visible. */
	useSidebarVM: ReturnType<typeof createPlaygroundArticleVM>;
}

/**
 * The entry point, in the order an application's own must use.
 *
 * `registerInstance` rather than `register`: `nanoquery()` is the application's
 * and is a required parameter, so the locator cannot build the cache itself. An
 * application already using nanostores for its own state passes ITS instance
 * here, which is the reason to take this member over the recommended one.
 */
export const startPlayground = async (
	transport: ILankaTransport<RequestInit>,
	instance: TLankaNanostoresClient = nanoquery() as unknown as TLankaNanostoresClient,
): Promise<IPlaygroundApp> => {
	const lanka = createLanka({ host: lankaTestHost });
	lanka.activate();

	const articleGateway = new PlaygroundArticleGateway(transport);
	lanka.locators.singletons.registerInstance("ReadCache", createLankaNanostoresCache(instance));
	lanka.locators.gateways.registerInstance("PlaygroundArticleGateway", articleGateway);

	await lanka.bootstrap();
	lankaScenarioBootstrap.bootstrap();

	const cache = lanka.resolve<ILankaReadCache>("readCache");

	return {
		lanka,
		cache,
		useArticleVM: createPlaygroundArticleVM(articleGateway, cache),
		useSidebarVM: createPlaygroundArticleVM(articleGateway, cache, "PlaygroundSidebarVM"),
	};
};
