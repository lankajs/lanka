import { QueryClient } from "@tanstack/query-core";
import { createLankaTanstackCache } from "@lankajs/tanstack-query";
import { lankaDevtools } from "@lankajs/plugin-devtools";
import { lankaPrefetch } from "@lankajs/plugin-prefetch";
import { lankaSse } from "@lankajs/plugin-sse";
import { lankaWebSocket } from "@lankajs/plugin-websocket";
import {
	createAtlasAvatarCache,
	startAtlas,
	createAtlasReleaseGuard,
} from "@lanka-playgrounds/_shared";
import type { LankaBlobCachePolicy } from "@lankajs/blob-cache";
import type { IAtlasApp } from "@lanka-playgrounds/_shared";
import type { ILankaReadCache } from "lanka/cache";
import type { ILankaWebSocketChannel } from "@lankajs/plugin-websocket";

export interface IAtlasVueConfig {
	apiBaseUrl: string;
	/** Whether to open the two connections. Off in a test that does not want them. */
	connect?: boolean;
	isDevelopment?: boolean;
}

/** Atlas plus everything only a browser can do. */
export interface IAtlasVueApp {
	app: IAtlasApp;
	avatars: LankaBlobCachePolicy;
	cache: ILankaReadCache;
	channel: ILankaWebSocketChannel;
	/**
	 * Notices that a new build shipped, and drops the caches the old one filled.
	 *
	 * Here rather than in `startAtlas` because it is browser-only: a server has no
	 * stale bundle to replace, and a device updates through its store. It ANSWERS
	 * rather than acts — reloading is the commonest response and the worst
	 * default, since somebody halfway through a dispatch would lose it.
	 */
	releaseGuard: ReturnType<typeof createAtlasReleaseGuard>;
	stop: () => void;
}

/**
 * The browser half of start-up, in a Vue application.
 *
 * Read it beside `_playgrounds/react/spa/src/startAtlasBrowser.ts`: the plugins
 * are the same plugins, the caches are the same caches, the gateways are the
 * same gateways, and nothing in this file mentions Vue. That is the claim the
 * whole of `_plans/14` was written to make, and a start-up file is where it is
 * easiest to check — because if the framework knew which renderer it was under,
 * this is where it would show.
 *
 * It reaches every browser-side package React's does, and that is a requirement
 * rather than a courtesy: a package proved under one framework is a package
 * proved under one framework. `check:playgrounds` holds the five to the same
 * list for the same reason.
 */
export const startAtlasVue = async (config: IAtlasVueConfig): Promise<IAtlasVueApp> => {
	const app = await startAtlas({
		apiBaseUrl: config.apiBaseUrl,
		isDevelopment: config.isDevelopment,
		signInAs: "Ada",
	});

	// `retry: false`, because retrying belongs to the request policy, where it
	// travels with an idempotency key. A second retry here multiplies the first.
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	const cache = createLankaTanstackCache(client);

	// `registerInstance`, not `register`: the locator builds a class with no
	// arguments, and the client is an argument. A default would let a second
	// client exist without anybody noticing — and two clients disagree on the
	// first mutation, silently.
	app.lanka.locators.singletons.registerInstance("AtlasReadCache", cache);

	// Installed FIRST, so its request middleware wraps the retry policy rather
	// than sitting inside it: one row is then one call the application made,
	// including whatever it took to succeed.
	const devtools = lankaDevtools({ exposeAs: "__atlas" });
	app.lanka.use(devtools);

	const sse = lankaSse({ path: "/sse/events" });
	const socket = lankaWebSocket({ path: "/ws" });
	const prefetch = lankaPrefetch({ intent: { ttlMs: 20_000 } });

	app.lanka.use(sse);
	app.lanka.use(socket);
	app.lanka.use(prefetch);

	// Not on install, deliberately. A stream is opened for an AUTHENTICATED user,
	// and when that happens is the application's knowledge.
	if (config.connect !== false) {
		sse.sse.connect();
		socket.socket.connect();
	}

	return {
		app,
		releaseGuard: createAtlasReleaseGuard(config.apiBaseUrl),
		// Built here rather than inside a screen: the bytes outlive any one view,
		// and a cache per screen is a cache that starts empty every time somebody
		// navigates — which is the fetch it exists to avoid.
		avatars: createAtlasAvatarCache(),
		cache,
		channel: socket.socket,
		stop: () => {
			socket.socket.disconnect();
			sse.sse.disconnect();
			app.lanka.dispose();
		},
	};
};
