import { provideZonelessChangeDetection } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import { provideServerRendering, renderApplication } from "@angular/platform-server";
import {
	AtlasBoardVM,
	createAtlasAvatarCache,
	createAtlasMissionsVM,
} from "@lanka-playgrounds/_shared";
import { ATLAS_MISSIONS_VM } from "@lanka-playgrounds/angular-shared";
import { hydrateLankaVM } from "@lankajs/host";
import { AtlasApp } from "../../App/AtlasApp";
import { ATLAS_BOARD_VM } from "../../Modules/AtlasBoardModule/atlasBoardVM";
import { ATLAS_AVATARS } from "../../Modules/AtlasMissionsModule/atlasAvatars";
import { readAtlasMissions } from "./readAtlasMissions";
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
 * request scope before the render began. So `list` answers with those, and the
 * screen's `ngOnInit` — which does not know it is on a server — gets what it
 * asked for without a second network call.
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
 * One project and two entry points, which is Angular's own arrangement and the
 * reason this ecosystem needs no second package: `main.ts` bootstraps into a
 * document, this renders into a string, and the component tree between them is
 * the same tree. React, Vue and Svelte each needed a separate application for
 * their server host, because in those frameworks the server story IS a separate
 * project; Angular's is a second call against the same one.
 *
 * ## The ViewModels are built HERE, per render
 *
 * Every provider below belongs to ONE call of this function, so two overlapping
 * requests never share a ViewModel. On a server that is not a nicety: a
 * module-level provider would be one store for every user connected to the
 * process, and the first request to write a draft into it would serve that draft
 * to the next stranger. `_playgrounds/svelte/sveltekit` states the same rule for
 * the same reason, and `_playgrounds/vue/nuxt` states its opposite for a reason
 * that belongs to Vue.
 *
 * ## The handoff is DATA, not state
 *
 * `readAtlasMissions` fetches inside a request scope and `hydrateLankaVM` makes
 * the result the ViewModel's first state, so the FIRST frame the user is sent
 * already has rows in it. The browser picks up from there rather than fetching
 * again for what the HTML already contained.
 */
export const renderAtlasPage = async (
	headers: TLankaIncomingHeaders,
	document = "<atlas-app></atlas-app>",
): Promise<string> => {
	const missions = await readAtlasMissions(headers);
	const gateways = atlasServerGateways(missions);
	const missionsVM = createAtlasMissionsVM(gateways.missionGateway);

	hydrateLankaVM(missionsVM, { missions });

	const boardVM = new AtlasBoardVM(gateways.boardGateway).build();

	/*
	 * The `context` is forwarded, and leaving it out is an error that names
	 * itself: NG0401, "Missing Platform". `renderApplication` creates the server
	 * platform and hands it to the callback — a `bootstrapApplication` called
	 * without it looks for a browser platform that a node process does not have.
	 */
	return renderApplication(
		(context) =>
			bootstrapApplication(
				AtlasApp,
				{
					providers: [
						provideServerRendering(),
						provideZonelessChangeDetection(),
						{ provide: ATLAS_MISSIONS_VM, useValue: missionsVM },
						{ provide: ATLAS_BOARD_VM, useValue: boardVM },
						{ provide: ATLAS_AVATARS, useValue: atlasServerAvatars() },
					],
				},
				context,
			),
		{ document },
	);
};
