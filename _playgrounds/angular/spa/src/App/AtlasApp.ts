import { ChangeDetectionStrategy, Component } from "@angular/core";
import { AtlasBoardScreen } from "../Modules/AtlasBoardModule/AtlasBoardScreen";
import { AtlasMissionsScreen } from "../Modules/AtlasMissionsModule/AtlasMissionsScreen";

/**
 * The shell: every screen at once.
 *
 * It holds no ViewModel and builds none. In every other ecosystem here the shell
 * is where the ViewModels are constructed, because a prop is the only way to
 * hand a component one; in Angular they arrive from the INJECTOR, so the place
 * that builds them is the place that creates the injector — `startAtlasAngular`
 * in a browser, `renderAtlasPage` on a server.
 *
 * That is why this file is four lines and the others are twenty. The lifetime
 * question every other shell answers in code, Angular answers in a provider.
 */
@Component({
	selector: "atlas-app",
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [AtlasMissionsScreen, AtlasBoardScreen],
	template: `
		<main>
			<atlas-missions-screen />
			<atlas-board-screen />
		</main>
	`,
})
export class AtlasApp {}
