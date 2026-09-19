import { AtlasBoardVM, createAtlasMissionsVM } from "@lanka-playgrounds/_shared";
import { hydrateLankaVM } from "@lankajs/host";
import { AtlasBoardScreen } from "../Modules/AtlasBoardModule/AtlasBoardScreen";
import { AtlasMissionsScreen } from "../Modules/AtlasMissionsModule/AtlasMissionsScreen";
import type { IAtlasSolidApp } from "../startAtlasSolid";
import type { IAtlasMission } from "@lanka-playgrounds/_shared";
import type { LankaBlobCachePolicy } from "@lankajs/blob-cache";

export interface IAtlasAppProps {
	app: IAtlasSolidApp;
	/**
	 * The avatar bytes, built and hydrated by the entry rather than here.
	 *
	 * A prop, because hydration is asynchronous and a shell that started it would
	 * paint its first screen before the cache could answer — the one moment the
	 * cache exists for. It is also what lets a test hand over a cache with no
	 * browser under it.
	 */
	avatars: LankaBlobCachePolicy;
	/**
	 * Rows somebody else already read, made the missions ViewModel's FIRST state.
	 *
	 * `src/Core/Server/renderAtlasPage.ts` is the one caller that passes it, and
	 * without it a server render ships an empty board: `onMount` does not run on a
	 * server, so the screen never asks, and nothing anywhere reports that it
	 * did not. In a browser there is nothing to hand over and the screen fetches
	 * for itself — which is why this is optional rather than a second entry point.
	 */
	missions?: readonly IAtlasMission[];
}

/**
 * The shell: every screen at once, over one started application.
 *
 * The ViewModels are built HERE rather than at module level, and that is what
 * lets this be mounted twice in one process, which is what a test does. A
 * module-level ViewModel is one store per PROCESS: right for a browser tab,
 * wrong for a suite, and wrong for a server.
 *
 * In Solid that costs nothing to say and nothing to do: a component body runs
 * ONCE, so these two lines are a constructor rather than something re-executed
 * on every change. React's shell needs `useMemo` or a ref to make the same
 * promise, and Svelte's needs an instance script — this is the framework where
 * the obvious spelling is also the correct one.
 *
 * It is also what makes the server render safe without a word being added there:
 * a per-RENDER ViewModel is the only kind a process serving two users at once
 * may have, and the body of a component that runs once is exactly one render.
 *
 * `hydrateLankaVM` is called BEFORE the first read, which on a server is the
 * only place it can be: the screen below is about to be turned into a string,
 * and a state that arrived after that string exists never reaches anybody. The
 * first call wins and later ones are ignored, so a browser that later fetches
 * for itself is going through an action rather than a second hydration.
 */
export const AtlasApp = (props: IAtlasAppProps) => {
	const missionsVM = createAtlasMissionsVM(props.app.app.missionGateway);

	if (props.missions) hydrateLankaVM(missionsVM, { missions: props.missions });

	const boardVM = new AtlasBoardVM(props.app.app.boardGateway).build();

	return (
		<main>
			<AtlasMissionsScreen missionsVM={missionsVM} avatars={props.avatars} />
			<AtlasBoardScreen boardVM={boardVM} />
		</main>
	);
};
