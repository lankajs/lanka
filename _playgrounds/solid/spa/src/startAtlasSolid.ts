import { createLankaTanstackCache } from "@lankajs/tanstack-query";
import { lankaDevtools } from "@lankajs/plugin-devtools";
import { lankaPrefetch } from "@lankajs/plugin-prefetch";
import { lankaSse } from "@lankajs/plugin-sse";
import { lankaWebSocket } from "@lankajs/plugin-websocket";
import { QueryClient } from "@tanstack/query-core";
import { startAtlas, createAtlasReleaseGuard } from "@lanka-playgrounds/_shared";
import type { IAtlasApp } from "@lanka-playgrounds/_shared";
import type { ILankaReadCache } from "lanka/cache";
import type { ILankaWebSocketChannel } from "@lankajs/plugin-websocket";

export interface IAtlasSolidConfig {
	apiBaseUrl: string;
	/** Whether to open the two connections. Off in a test that does not want them. */
	connect?: boolean;
	isDevelopment?: boolean;
}

/** Atlas plus everything only a browser can do. */
export interface IAtlasSolidApp {
	app: IAtlasApp;
	/** The read cache under the ViewModels: one client, registered by name. */
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
 * The browser half of start-up, in a Solid application.
 *
 * Read it beside the same file in `../../react/spa`, `../../vue/spa` and
 * `../../svelte/spa`: the plugins are the same plugins, the gateways are the
 * same gateways, and nothing in this file mentions Solid. That is the claim the
 * whole of `_plans/14` was written to make, and a start-up file is where it is
 * easiest to check — because if the framework knew which renderer it was under,
 * this is where it would show.
 */
export const startAtlasSolid = async (config: IAtlasSolidConfig): Promise<IAtlasSolidApp> => {
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
	app.lanka.use(lankaDevtools({ exposeAs: "__atlas" }));

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
		cache,
		channel: socket.socket,
		stop: () => {
			socket.socket.disconnect();
			sse.sse.disconnect();
			app.lanka.dispose();
		},
	};
};
