import { createLankaTanstackCache } from "@lankajs/tanstack-query";
import { lankaDevtools } from "@lankajs/plugin-devtools";
import { lankaPrefetch } from "@lankajs/plugin-prefetch";
import { lankaSse } from "@lankajs/plugin-sse";
import { lankaWebSocket } from "@lankajs/plugin-websocket";
import { QueryClient } from "@tanstack/query-core";
import { startAtlas } from "@lanka-playgrounds/_shared";
import { createAtlasBoardBridge } from "./Core/StreamBridges/createAtlasBoardBridge";
import { createAtlasChangeBridge } from "./Core/StreamBridges/createAtlasChangeBridge";
import type { IAtlasApp } from "@lanka-playgrounds/_shared";
import type { ILankaReadCache } from "lanka/cache";
import type { ILankaWebSocketChannel } from "@lankajs/plugin-websocket";

export interface IAtlasBrowserConfig {
	apiBaseUrl: string;
	/** Whether to open the two connections. Off in a test that does not want them. */
	connect?: boolean;
	isDevelopment?: boolean;
}

/** Atlas plus everything only a browser can do. */
export interface IAtlasBrowser {
	app: IAtlasApp;
	/** The read cache under the ViewModels: one client, registered by name. */
	cache: ILankaReadCache;
	/** The board's two-way wire, for whoever owns the action that answers. */
	channel: ILankaWebSocketChannel;
	stop: () => void;
}

/**
 * The browser half of start-up: the parts a device and a server do not have.
 *
 * Atlas starts itself — gateways, scenarios, the request policy, the start-up
 * chain — and everything added here needs a window, a socket or a DOM. Keeping
 * that line visible is the whole reason this file is separate from
 * `startAtlas`: what is above the line runs in four hosts, and what is below it
 * runs in one.
 */
export const startAtlasBrowser = async (config: IAtlasBrowserConfig): Promise<IAtlasBrowser> => {
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

	const sse = lankaSse({
		path: "/sse/events",
		bridges: ({ sse: stream, trigger }) => [createAtlasChangeBridge()(stream, trigger)],
	});
	const socket = lankaWebSocket({
		path: "/ws/board",
		bridges: ({ socket: channel, trigger }) => [createAtlasBoardBridge()(channel, trigger)],
	});
	const prefetch = lankaPrefetch({ intent: { ttlMs: 20_000 } });

	app.lanka.use(sse);
	app.lanka.use(socket);
	app.lanka.use(prefetch);

	// Not on install, deliberately. A stream is opened for an AUTHENTICATED user,
	// and when that happens is the application's knowledge — a plugin that
	// connected on registration would open a connection on the sign-in screen.
	if (config.connect !== false) {
		sse.sse.connect();
		socket.socket.connect();
	}

	return {
		app,
		cache,
		channel: socket.socket,
		stop: () => {
			sse.sse.disconnect();
			socket.socket.disconnect();
			app.lanka.dispose();
		},
	};
};
