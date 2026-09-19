import { createComponent } from "solid-js";
import { renderToString } from "solid-js/web";
import { createAtlasAvatarCache } from "@lanka-playgrounds/_shared";
import { AtlasApp } from "../../App/AtlasApp";
import { readAtlasMissions } from "./readAtlasMissions";
import type { IAtlasSolidApp } from "../../startAtlasSolid";
import type {
	AtlasBoardGateway,
	AtlasMissionGateway,
	IAtlasMission,
} from "@lanka-playgrounds/_shared";
import type { TLankaIncomingHeaders } from "@lankajs/host/server";

/**
 * The gateways a SERVER-RENDERED screen is given.
 *
 * The rows are already in hand: `readAtlasMissions` fetched them inside a
 * request scope before the render began, so `list` answers with those and a
 * screen that asks — which does not know it is on a server — is not sent back
 * over the network for what the renderer is holding.
 *
 * The two writing methods reject, and that is the design rather than an
 * omission: a render produces a string, and an action that completed a mission
 * halfway through producing one would have changed the world for a page nobody
 * has seen yet. Nothing calls them during a render, and if something starts to,
 * the rejection is where it is noticed.
 */
export const atlasServerGateways = (missions: readonly IAtlasMission[]) => ({
	missionGateway: {
		list: () => Promise.resolve([...missions]),
		complete: () => Promise.reject(new Error("a server render cannot complete a mission")),
		remove: () => Promise.reject(new Error("a server render cannot remove a mission")),
	} as unknown as AtlasMissionGateway,
	boardGateway: {
		summary: () => Promise.resolve(null),
		post: () => Promise.reject(new Error("a server render cannot post to the board")),
	} as unknown as AtlasBoardGateway,
});

/**
 * The avatar cache a SERVER-RENDERED screen is given: one with nothing under it.
 *
 * The same sentence as the gateways above, about bytes rather than writes. Every
 * rung this policy can choose belongs to a browser — IndexedDB, Cache Storage,
 * an object URL pinning a blob — and a render produces a string and then ends,
 * so a stored blob would be written for a process that never reads it back.
 *
 * No environment is passed, which is the point rather than an omission. The
 * package's default DETECTS what is there instead of being told, and on a server
 * it finds none of the three and says so by answering the network URL — which is
 * what the first frame has to contain anyway, because the browser receiving the
 * HTML has a cache of its own and this process's is not shared with anybody.
 */
export const atlasServerAvatars = () => createAtlasAvatarCache();

/**
 * The same shell, rendered to a string, for a user who is waiting.
 *
 * One project and two entry points, which is Angular's arrangement reached from
 * the other end: Angular has a server renderer in the box, Solid has
 * `renderToString` and no meta-framework at all. React, Vue and Svelte each
 * needed a SECOND package for their server host, because in those frameworks
 * the server story is a separate project; here it is a second call against the
 * same `AtlasApp` the browser mounts, compiled for a different target by the one
 * plugin both halves already use.
 *
 * SolidStart is deliberately not that meta-framework, and the reason is written
 * down in `_plans/14-framework-independence.md`: its 2.x line wants a Vite this
 * repository is two majors away from, and its 1.x line brings a second Vite of
 * its own. Nothing about the seam needed it.
 *
 * `createComponent` rather than `<AtlasApp …/>` because this file is `.ts`, and
 * the two compile to the same call — the JSX spelling is what the plugin emits.
 *
 * ## The ViewModels belong to ONE render
 *
 * The shell builds them in its body, and a Solid body runs once, so a render is
 * already their whole lifetime. On a server that is not a nicety: a ViewModel
 * built at module level would be one store for every user connected to the
 * process, and the first request to write a draft into it would serve that draft
 * to the next stranger. `_playgrounds/svelte/sveltekit` states the same rule for
 * the same reason, and `_playgrounds/vue/nuxt` states its opposite for a reason
 * that belongs to Vue.
 *
 * ## The handoff is DATA, not state
 *
 * `readAtlasMissions` fetches inside a request scope and the rows are handed to
 * the shell, which makes them the ViewModel's first state — so the FIRST frame
 * the user is sent already has the board in it. Nothing else would: a Solid
 * component's `onMount` does not run on a server, so a render that expected the
 * screen to fetch for itself would ship an empty list and never say so.
 */
export const renderAtlasPage = async (headers: TLankaIncomingHeaders): Promise<string> => {
	const missions = await readAtlasMissions(headers);
	const app = { app: atlasServerGateways(missions) } as unknown as IAtlasSolidApp;

	return renderToString(() =>
		createComponent(AtlasApp, { app, avatars: atlasServerAvatars(), missions }),
	);
};
