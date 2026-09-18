import { lankaSse } from "@lankajs/plugin-sse";
import { lankaWebSocket } from "@lankajs/plugin-websocket";
import { startAtlas } from "@lanka-playgrounds/_shared";
import type { IAtlasApp } from "@lanka-playgrounds/_shared";
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
	channel: ILankaWebSocketChannel;
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

	const sse = lankaSse({ path: "/sse/events" });
	const socket = lankaWebSocket({ path: "/ws" });

	app.lanka.use(sse);
	app.lanka.use(socket);

	// Not on install, deliberately. A stream is opened for an AUTHENTICATED user,
	// and when that happens is the application's knowledge.
	if (config.connect !== false) {
		sse.sse.connect();
		socket.socket.connect();
	}

	return {
		app,
		channel: socket.socket,
		stop: () => {
			socket.socket.disconnect();
			sse.sse.disconnect();
			app.lanka.dispose();
		},
	};
};
