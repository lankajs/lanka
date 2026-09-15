import { lankaSse } from "@lankajs/plugin-sse";
import { lankaWebSocket } from "@lankajs/plugin-websocket";
import { startAtlas } from "@lanka-playgrounds/_shared";
import type { IAtlasApp } from "@lanka-playgrounds/_shared";
import type { ILankaWebSocketChannel } from "@lankajs/plugin-websocket";

export interface IAtlasNodeConfig {
	apiBaseUrl: string;
	/** Whether to open the two connections. Off in a test that does not want them. */
	connect?: boolean;
	isDevelopment?: boolean;
}

/** Atlas in a process with no screen. */
export interface IAtlasNode {
	app: IAtlasApp;
	/** The board's two-way wire, opened with node's own `WebSocket`. */
	channel: ILankaWebSocketChannel;
	stop: () => void;
}

/**
 * Start-up for a process that renders nothing.
 *
 * The shortest file of the five, and what it does NOT contain is the point: no
 * renderer, no provider, no root component, no read cache. `startAtlas` — the
 * transport, the request policy, the gateways, the scenarios, the start-up chain
 * — runs here unchanged, because none of it ever needed a document.
 *
 * ## The two wires, and only one of them is free here
 *
 * `WebSocket` is a node global, so the socket plugin connects with no shim at
 * all. `EventSource` is NOT — node has it behind `--experimental-eventsource`
 * and nowhere else — and this is what the SSE transport's "no `EventSource` is
 * not a failure" rule is for: it ASKS whether the class exists and stays quiet
 * when it does not, so this service starts, serves and watches with one wire
 * open instead of throwing at boot over a capability it may not need.
 *
 * That asymmetry is worth meeting in a playground rather than in production. A
 * deployment that wants server-sent events here installs a polyfill on
 * `globalThis` before start-up, or runs node with the flag; a deployment that is
 * happy with the socket changes nothing. Either way the ViewModels above are the
 * same ViewModels, which is the property this whole folder is about.
 *
 * A background worker consuming the same facts a browser consumes, through the
 * same plugins, is the case this playground exists for — and the one where "a
 * ViewModel is a store, not a hook" stops being a design note and becomes the
 * reason the code compiles at all.
 */
export const startAtlasNode = async (config: IAtlasNodeConfig): Promise<IAtlasNode> => {
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
	// and when that happens is the application's knowledge — which is as true of a
	// worker holding a service token as of a browser holding a session.
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
