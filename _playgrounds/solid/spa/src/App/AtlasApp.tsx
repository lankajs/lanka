import { AtlasBoardVM, createAtlasMissionsVM } from "@lanka-playgrounds/_shared";
import { AtlasBoardScreen } from "../Modules/AtlasBoardModule/AtlasBoardScreen";
import { AtlasMissionsScreen } from "../Modules/AtlasMissionsModule/AtlasMissionsScreen";
import type { IAtlasSolidApp } from "../startAtlasSolid";

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
 */
export const AtlasApp = (props: { app: IAtlasSolidApp }) => {
	const missionsVM = createAtlasMissionsVM(props.app.app.missionGateway);
	const boardVM = new AtlasBoardVM(props.app.app.boardGateway).build();

	return (
		<main>
			<AtlasMissionsScreen missionsVM={missionsVM} />
			<AtlasBoardScreen boardVM={boardVM} />
		</main>
	);
};
