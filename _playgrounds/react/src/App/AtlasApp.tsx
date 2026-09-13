import { useMemo } from "react";
import {
	AtlasBoardVM,
	AtlasDispatchDraftStore,
	AtlasDispatchStepVM,
	createAtlasCrewStepVM,
	createAtlasMissionsVM,
	createAtlasTelemetryVM,
} from "@lanka-playgrounds/_shared";
import { AtlasBoardChannel } from "../Gateways/AtlasBoardChannel/AtlasBoardChannel";
import { AtlasBoardScreen } from "../Modules/AtlasBoardModule/AtlasBoardScreen";
import { AtlasDispatchScreen } from "../Modules/AtlasDispatchModule/AtlasDispatchScreen";
import { AtlasMissionsScreen } from "../Modules/AtlasMissionsModule/AtlasMissionsScreen";
import { AtlasTelemetryScreen } from "../Modules/AtlasTelemetryModule/AtlasTelemetryScreen";
import type { IAtlasBrowser } from "../startAtlasBrowser";
import type { JSX } from "react";
import type { LankaBlobCachePolicy } from "@lankajs/blob-cache";

export interface IAtlasAppProps {
	browser: IAtlasBrowser;
	avatars: LankaBlobCachePolicy;
}

/**
 * The application, assembled once.
 *
 * The ViewModels are built in a `useMemo` rather than at module level, and that
 * is not a React habit — it is what lets this component be mounted twice in one
 * process, which is what a test does. A module-level ViewModel is one store per
 * PROCESS: right for a browser tab, wrong for a suite, and wrong for a server.
 *
 * Nothing below this line knows how anything arrives. A mission completed by
 * this screen, by somebody else over the socket, or by the server-sent stream
 * reaches the same handler, because all three end as the same fact.
 */
export const AtlasApp = ({ browser, avatars }: IAtlasAppProps): JSX.Element => {
	const screens = useMemo(() => {
		const store = new AtlasDispatchDraftStore();

		return {
			useMissionsVM: createAtlasMissionsVM(browser.app.missionGateway),
			useBoardVM: new AtlasBoardVM(browser.app.boardGateway).build(),
			useStepVM: new AtlasDispatchStepVM(store).build(),
			useCrewStepVM: createAtlasCrewStepVM(store),
			useTelemetryVM: createAtlasTelemetryVM(browser.app.telemetryGateway),
			channel: new AtlasBoardChannel(browser.channel),
		};
	}, [browser]);

	return (
		<main>
			<h1>Atlas</h1>
			<p data-testid="operator">{browser.app.session.current()?.name ?? "signed out"}</p>

			<AtlasMissionsScreen useMissionsVM={screens.useMissionsVM} avatars={avatars} />
			<AtlasBoardScreen useBoardVM={screens.useBoardVM} channel={screens.channel} />
			<AtlasDispatchScreen
				useStepVM={screens.useStepVM}
				useCrewStepVM={screens.useCrewStepVM}
				onPlace={(draft) => {
					void browser.app.missionGateway.create({
						title: draft.title,
						priority: draft.priority,
						crewId: draft.crewId,
					});
				}}
			/>
			<AtlasTelemetryScreen useTelemetryVM={screens.useTelemetryVM} />
		</main>
	);
};
