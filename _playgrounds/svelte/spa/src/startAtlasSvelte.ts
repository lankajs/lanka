import { createLankaNanostoresCache } from "@lankajs/nanostores-query";
import { lankaDevtools } from "@lankajs/plugin-devtools";
import { lankaPrefetch } from "@lankajs/plugin-prefetch";
import { lankaSse } from "@lankajs/plugin-sse";
import { lankaWebSocket } from "@lankajs/plugin-websocket";
import { nanoquery } from "@nanostores/query";
import {
	createAtlasAvatarCache,
	startAtlas,
	createAtlasReleaseGuard,
} from "@lanka-playgrounds/_shared";
import type { IAtlasApp } from "@lanka-playgrounds/_shared";
import type { ILankaReadCache } from "lanka/cache";
import type { ILankaWebSocketChannel } from "@lankajs/plugin-websocket";
import type { LankaBlobCachePolicy } from "@lankajs/blob-cache";
import type { TLankaNanostoresClient } from "@lankajs/nanostores-query";

export interface IAtlasSvelteConfig {
	apiBaseUrl: string;
	/** Whether to open the two connections. Off in a test that does not want them. */
	connect?: boolean;
	isDevelopment?: boolean;
}

/** Atlas plus everything only a browser can do. */
export interface IAtlasSvelteApp {
	app: IAtlasApp;
	/** The avatar bytes, kept across every screen that renders a face. */
	avatars: LankaBlobCachePolicy;
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
 * The browser half of start-up, in a Svelte application.
 *
 * Read it beside `_playgrounds/react/spa/src/startAtlasBrowser.ts` and
 * `_playgrounds/vue/spa/src/startAtlasVue.ts`: the plugins are the same plugins,
 * the gateways are the same gateways, and nothing in this file mentions Svelte.
 * That is the claim the whole of `_plans/14` was written to make, and a start-up
 * file is where it is easiest to check — because if the framework knew which
 * renderer it was under, this is where it would show.
 *
 * It reaches every browser-side package the React application does, and that is
 * a requirement rather than a courtesy: a package proved under one framework is
 * a package proved under one framework.
 *
 * ## This one takes the OTHER member of the query family
 *
 * React, Vue and Solid read through `@lankajs/tanstack-query`; this application
 * reads through `@lankajs/nanostores-query`, and the difference is deliberate.
 * The two are one `parallel` family in `scripts/registry.mjs` — same port, same
 * `ILankaReadCache`, same ViewModels above them — and a family is only
 * interchangeable if something actually interchanges. An application that swaps
 * one member for another and changes NOTHING but the line that builds it is the
 * proof, and it is a proof no unit test can give: a conformance suite checks one
 * member against the port, not two members against each other.
 *
 * What it costs is stated where it is paid: `cancel` is absent from this member,
 * because `@nanostores/query` never hands its fetcher an `AbortSignal`. Nothing
 * here calls it, so nothing here notices — which is the honest version of the
 * claim rather than a stronger one.
 */
export const startAtlasSvelte = async (config: IAtlasSvelteConfig): Promise<IAtlasSvelteApp> => {
	const app = await startAtlas({
		apiBaseUrl: config.apiBaseUrl,
		isDevelopment: config.isDevelopment,
		signInAs: "Ada",
	});

	// The application's OWN `nanoquery()`, which is the entire reason to pick this
	// member: the cache the ViewModels read through is the one the rest of the
	// application's nanostores code already holds. A second instance would be two
	// caches for one resource, disagreeing on the first mutation.
	//
	// The cast is because this library types its tuple wider than the three
	// entries this member uses, and `TLankaNanostoresClient` names exactly those.
	const client = nanoquery() as unknown as TLankaNanostoresClient;
	const cache = createLankaNanostoresCache(client);

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
