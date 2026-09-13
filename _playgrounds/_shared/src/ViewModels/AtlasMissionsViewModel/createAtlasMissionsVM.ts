import { createLankaVM } from "lanka/viewmodel";
import { createAtlasMissionsActions } from "./_Services/createAtlasMissionsActions";
import { atlasMissionAssigned } from "../../Scenarios/Scenarios/AtlasMissionAssigned/atlasMissionAssigned";
import { atlasMissionCompleted } from "../../Scenarios/Scenarios/AtlasMissionCompleted/AtlasMissionCompleted";
import { atlasSessionEnded } from "../../Scenarios/Scenarios/AtlasSessionEnded/atlasSessionEnded";
import { atlasStreamReconnected } from "../../Scenarios/Scenarios/AtlasStreamReconnected/atlasStreamReconnected";
import { createAtlasMissionView } from "./_Services/createAtlasMissionView";
import { replaceAtlasMission } from "./_Services/replaceAtlasMission";
import type { AtlasMissionGateway } from "../../Gateways/AtlasMissionGateway/AtlasMissionGateway";
import type { TAtlasMissionAssignedEventData } from "../../Scenarios/ScenarioTypes/TAtlasMissionAssignedEventData";
import type { TAtlasMissionCompletedEventData } from "../../Scenarios/ScenarioTypes/TAtlasMissionCompletedEventData";
import type { IAtlasMissionsActions } from "../../Core/Interfaces/IAtlasMissionsActions";
import type { IAtlasMissionsState } from "../../Core/Interfaces/IAtlasMissionsState";

/** What this ViewModel reaches for, by name rather than by import. */
export interface IAtlasMissionGateways {
	missionGateway: AtlasMissionGateway;
}

/**
 * The missions screen: its state, its actions, and what it listens to.
 *
 * It reads as a DECLARATION because the behaviour lives beside it — the actions
 * in their own file, the collection view in another, the row replacement in a
 * third. What is left here is the wiring, which is the part a reader comes to
 * this file for.
 *
 * The three things worth noticing:
 *
 * - **The collection view is built ONCE**, outside the config, and held for as
 *   long as the ViewModel. Each of its four operations remembers its last
 *   answer, and the memory IS the product: a view rebuilt inside an action
 *   remembers nothing and costs more than calling the plain functions.
 * - **A scenario handler applies the DATA it was given** rather than refetching.
 *   The fact carries the mission when the server returned one, and a subscriber
 *   that refetched on every announcement would turn one save into N requests.
 * - **`AtlasSessionEnded` empties the screen.** What a fact MEANS is the
 *   subscriber's decision, which is why the service that noticed the token was
 *   gone did not call this ViewModel.
 */
export const createAtlasMissionsVM = (missionGateway: AtlasMissionGateway) => {
	const view = createAtlasMissionView();

	return createLankaVM<IAtlasMissionsState, IAtlasMissionsActions, IAtlasMissionGateways>({
		name: "AtlasMissionsVM",
		/*
		 * Access tracking OFF, and this is the documented remedy rather than a
		 * workaround.
		 *
		 * The hook re-renders a component only for the keys it read THROUGH THE
		 * PROXY. `rows()` reads `missions`, `search`, `sort` and `page` inside
		 * itself, through `get()` — past the proxy — so a screen whose only link to
		 * the list is that call never hears about a change to it. There is no
		 * error: the screen simply freezes, which is the worst way for this to go
		 * wrong.
		 *
		 * The framework notices in development and warns, naming the ViewModel and
		 * the key. The alternative "fix" — destructuring `missions` in the
		 * component for the side effect of reading it — reads as dead code, and the
		 * next refactor or lint autofix deletes it.
		 */
		enableAccessTrackingOptimization: false,
		gateways: () => ({ missionGateway }),
		states: {
			missions: [],
			search: "",
			sort: { field: null, order: null },
			page: 1,
			isLoading: false,
			error: null,
			refreshes: 0,
		},
		createActions: (context) => createAtlasMissionsActions(context, view),

		scenarioHandlers: [
			{
				scenario: atlasMissionCompleted,
				handler:
					({ get, set }) =>
					(data?: TAtlasMissionCompletedEventData) => {
						if (!data?.mission) return;
						set({ missions: replaceAtlasMission(get().missions, data.mission) });
					},
			},
			{
				scenario: atlasMissionAssigned,
				handler:
					({ get, set }) =>
					(data?: TAtlasMissionAssignedEventData) => {
						if (!data?.mission) return;
						set({ missions: replaceAtlasMission(get().missions, data.mission) });
					},
			},
			{
				// A gap in what this screen was told. It refetches SILENTLY: a
				// skeleton over a readable list, for a reconnection nobody asked
				// for, reads as the application breaking rather than recovering.
				scenario: atlasStreamReconnected,
				handler:
					({ get }) =>
					() => {
						void get().refreshMissions();
					},
			},
			{
				scenario: atlasSessionEnded,
				handler:
					({ set }) =>
					() => {
						set({ missions: [], page: 1, error: null });
					},
			},
		],
	});
};
