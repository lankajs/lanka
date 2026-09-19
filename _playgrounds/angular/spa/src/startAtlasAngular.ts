import { provideZonelessChangeDetection } from "@angular/core";
import { QueryClient } from "@tanstack/query-core";
import { createLankaTanstackCache } from "@lankajs/tanstack-query";
import { lankaDevtools } from "@lankajs/plugin-devtools";
import { lankaPrefetch } from "@lankajs/plugin-prefetch";
import { lankaSse } from "@lankajs/plugin-sse";
import { lankaWebSocket } from "@lankajs/plugin-websocket";
import {
	AtlasBoardVM,
	createAtlasAvatarCache,
	createAtlasMissionsVM,
	createAtlasReleaseGuard,
	startAtlas,
} from "@lanka-playgrounds/_shared";
import { ATLAS_MISSIONS_VM } from "@lanka-playgrounds/angular-shared";
import { ATLAS_BOARD_VM } from "./Modules/AtlasBoardModule/atlasBoardVM";
import { ATLAS_AVATARS } from "./Modules/AtlasMissionsModule/atlasAvatars";
import type { ApplicationConfig } from "@angular/core";
import type { IAtlasApp } from "@lanka-playgrounds/_shared";
import type { ILankaReadCache } from "lanka/cache";
import type { ILankaWebSocketChannel } from "@lankajs/plugin-websocket";

export interface IAtlasAngularConfig {
	apiBaseUrl: string;
	/** Whether to open the two connections. Off in a test that does not want them. */
	connect?: boolean;
	isDevelopment?: boolean;
}

/** Atlas plus everything only a browser can do, plus the providers Angular needs. */
export interface IAtlasAngularApp {
	/**
	 * Notices that a new build shipped, and drops the caches the old one filled.
	 *
	 * Here rather than in `startAtlas` because it is browser-only: a server has no
	 * stale bundle to replace. It ANSWERS rather than acts — reloading is the
	 * commonest response and the worst default, since somebody halfway through a
	 * dispatch would lose it.
	 */
	releaseGuard: ReturnType<typeof createAtlasReleaseGuard>;
	app: IAtlasApp;
	/** The read cache under the ViewModels: one client, registered by name. */
	cache: ILankaReadCache;
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
 *
 * ## The cache is a provider too, and for the same reason the ViewModels are
 *
 * The avatar cache is built HERE and handed to the injector, not to a screen.
 * The bytes outlive every view that reads them, so a cache constructed inside a
 * component starts empty each time somebody navigates — which is the fetch it
 * exists to avoid — and two components each building one would be two stores of
 * the same faces. `Modules/AtlasMissionsModule/atlasAvatars.ts` states it at
 * length.
 */
export const startAtlasAngular = async (config: IAtlasAngularConfig): Promise<IAtlasAngularApp> => {
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
		cache,
		channel: socket.socket,
		config: {
			providers: [
				provideZonelessChangeDetection(),
				{ provide: ATLAS_MISSIONS_VM, useValue: createAtlasMissionsVM(app.missionGateway) },
				{ provide: ATLAS_BOARD_VM, useValue: new AtlasBoardVM(app.boardGateway).build() },
				{ provide: ATLAS_AVATARS, useValue: createAtlasAvatarCache() },
			],
		},
		stop: () => {
			socket.socket.disconnect();
			sse.sse.disconnect();
			app.lanka.dispose();
		},
	};
};
