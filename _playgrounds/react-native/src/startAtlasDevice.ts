import { lankaWebSocket } from "@lankajs/plugin-websocket";
import { startAtlas } from "@lanka-playgrounds/_shared";
import { AtlasDeviceSession } from "./Core/Storage/AtlasDeviceSession";
import { createAtlasDeviceStorage } from "./Core/Storage/createAtlasDeviceStorage";
import { readAtlasFirstFrame } from "./Core/Storage/readAtlasFirstFrame";
import type { IAtlasApp } from "@lanka-playgrounds/_shared";
import type { IAtlasDeviceEngines } from "./Core/Storage/createAtlasDeviceStorage";
import type { IAtlasFirstFrame } from "./Core/Storage/readAtlasFirstFrame";

export interface IAtlasDeviceConfig {
	apiBaseUrl: string;
	engines: IAtlasDeviceEngines;
	/** Whether to open the socket. Off in a test that does not want one. */
	connect?: boolean;
}

/** A started device application, and what it already knew before it rendered. */
export interface IAtlasDevice {
	app: IAtlasApp;
	session: AtlasDeviceSession;
	/** Read SYNCHRONOUSLY, before anything was rendered. */
	firstFrame: IAtlasFirstFrame;
	stop: () => void;
}

/**
 * The device half of start-up: the parts a browser and a server do not have.
 *
 * What is NOT here is the shorter list and the more interesting one. No
 * `@lankajs/host` — there is no server. No blob cache, no cookies, no release
 * guard, no server-sent events: every one of those is a browser API, and the
 * `check:runtime` gate is what keeps them out of a bundle that would have no
 * place to run them.
 *
 * A WebSocket IS here, because React Native has one — which is the honest line
 * between "a browser API" and "a web API a device also implements".
 *
 * The first frame is read before anything else, and synchronously. That is the
 * whole reason MMKV is in this application: an application that awaits its
 * storage renders the sign-in screen and then the board, which a person reads as
 * a flash rather than as a load.
 */
export const startAtlasDevice = async (config: IAtlasDeviceConfig): Promise<IAtlasDevice> => {
	const storage = createAtlasDeviceStorage(config.engines);
	const firstFrame = readAtlasFirstFrame(storage);
	const session = new AtlasDeviceSession(storage);

	const app = await startAtlas({
		apiBaseUrl: config.apiBaseUrl,
		signInAs: firstFrame.screen === "board" ? (session.operator() ?? "Ada") : "Ada",
	});

	const socket = lankaWebSocket({ path: "/ws/board" });
	app.lanka.use(socket);

	// Not on install: a socket is opened for an AUTHENTICATED user, and a plugin
	// that connected on registration would open one from the sign-in screen.
	if (config.connect !== false) socket.socket.connect();

	return {
		app,
		session,
		firstFrame,
		stop: () => {
			socket.socket.disconnect();
			app.lanka.dispose();
		},
	};
};
