import { provideZonelessChangeDetection } from "@angular/core";
import { lankaSse } from "@lankajs/plugin-sse";
import { lankaWebSocket } from "@lankajs/plugin-websocket";
import { AtlasBoardVM, createAtlasMissionsVM, startAtlas } from "@lanka-playgrounds/_shared";
import { ATLAS_MISSIONS_VM } from "@lanka-playgrounds/angular-shared";
import { ATLAS_BOARD_VM } from "./Modules/AtlasBoardModule/atlasBoardVM";
import type { ApplicationConfig } from "@angular/core";
import type { IAtlasApp } from "@lanka-playgrounds/_shared";
import type { ILankaWebSocketChannel } from "@lankajs/plugin-websocket";

export interface IAtlasAngularConfig {
	apiBaseUrl: string;
	/** Whether to open the two connections. Off in a test that does not want them. */
	connect?: boolean;
	isDevelopment?: boolean;
}

/** Atlas plus everything only a browser can do, plus the providers Angular needs. */
export interface IAtlasAngularApp {
	app: IAtlasApp;
	channel: ILankaWebSocketChannel;
	config: ApplicationConfig;
	stop: () => void;
}

/**
 * The browser half of start-up, in an Angular application.
 *
 * Read it beside the same file in the other four ecosystems: the plugins are the
 * same plugins, the gateways are the same gateways, and the only Angular in it is
 * the `ApplicationConfig` at the end. That is the claim the whole of `_plans/14`
 * was written to make, and a start-up file is where it is easiest to check.
 *
 * ## Why this file returns providers where the others return nothing
 *
 * Every other ecosystem builds its ViewModels in the SHELL, because a prop is
 * the only way to hand a component one. Angular has an injector, so the place
 * that builds a ViewModel is the place that creates the injector — and the
 * lifetime of the ViewModel becomes the lifetime of the application rather than
 * something a component has to be careful about.
 *
 * One consequence worth naming: two calls to this function are two applications
 * with two sets of ViewModels, which is what makes a test able to mount the
 * shell twice. A provider written at module level would be one store per
 * PROCESS — right for a browser tab, wrong for a suite, wrong for a server.
 *
 * ## `provideZonelessChangeDetection`, and no `zone.js` anywhere
 *
 * What the binding produces is a SIGNAL, and a signal is what zoneless change
 * detection already reads. A ViewModel that needed Zone would mean the framework
 * had a mechanism of its own to be patched.
 */
export const startAtlasAngular = async (config: IAtlasAngularConfig): Promise<IAtlasAngularApp> => {
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
		config: {
			providers: [
				provideZonelessChangeDetection(),
				{ provide: ATLAS_MISSIONS_VM, useValue: createAtlasMissionsVM(app.missionGateway) },
				{ provide: ATLAS_BOARD_VM, useValue: new AtlasBoardVM(app.boardGateway).build() },
			],
		},
		stop: () => {
			socket.socket.disconnect();
			sse.sse.disconnect();
			app.lanka.dispose();
		},
	};
};
