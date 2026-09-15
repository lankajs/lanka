import { AtlasBoardVM, createAtlasMissionsVM } from "@lanka-playgrounds/_shared";
import { atlasBoardScreen } from "./Modules/AtlasBoardModule/AtlasBoardScreen";
import { atlasMissionsScreen } from "./Modules/AtlasMissionsModule/AtlasMissionsScreen";
import { startAtlasVanilla } from "./startAtlasVanilla";
import type { IAtlasVanillaConfig } from "./startAtlasVanilla";

export interface IMountAtlasVanillaConfig extends IAtlasVanillaConfig {
	/** Where the application paints. */
	root: HTMLElement;
}

/** A mounted application: the framework, the screens, and how to take it down. */
export interface IMountedAtlasVanilla {
	operator: string;
	/**
	 * Where it painted.
	 *
	 * Handed back rather than assumed, because the caller gave it: a mount that
	 * only returned `stop` would leave a test — or a second mount in the same
	 * page — guessing which element was which.
	 */
	root: HTMLElement;
	stop: () => void;
}

/**
 * The application, assembled once.
 *
 * The ViewModels are built HERE rather than at module level, and that is not a
 * framework habit — it is what lets this be mounted twice in one process, which
 * is what a test does. A module-level ViewModel is one store per PROCESS: right
 * for a browser tab, wrong for a suite, and wrong for a server.
 *
 * That sentence is copied from `_playgrounds/react`'s `AtlasApp` on purpose. It
 * was true there because of `useMemo`; it is true here because of a function
 * call, and the rule it states belongs to neither framework.
 */
export const mountAtlasVanilla = async (
	config: IMountAtlasVanillaConfig,
): Promise<IMountedAtlasVanilla> => {
	const vanilla = await startAtlasVanilla(config);

	const missionsVM = createAtlasMissionsVM(vanilla.app.missionGateway);
	const boardVM = new AtlasBoardVM(vanilla.app.boardGateway).build();

	const missions = document.createElement("section");
	const board = document.createElement("section");
	config.root.append(missions, board);

	const stopMissions = atlasMissionsScreen({ missionsVM, root: missions });
	const stopBoard = atlasBoardScreen({ boardVM, root: board });

	await missionsVM.getState().fetchMissions();

	return {
		operator: vanilla.app.session.current()?.name ?? "signed out",
		root: config.root,
		stop: () => {
			stopMissions();
			stopBoard();
			vanilla.stop();
		},
	};
};
