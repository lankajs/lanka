import { useEffect } from "react";
import { useAtlasMissions } from "./useAtlasMissions";
import type { TAtlasMissionsVM } from "./useAtlasMissions";
import type { IAtlasMissionsActions, IAtlasMissionsState } from "@lanka-playgrounds/_shared";

/**
 * Read the missions ViewModel, and ask it for data once the screen exists.
 *
 * The pattern a client-only screen uses — the browser application and the device
 * application both, which is the whole reason it lives here: `FlatList` and `ul`
 * differ, and this does not.
 *
 * ## The effect is in the VIEW, and that is where it has to be
 *
 * A ViewModel owns state and actions. It does not know that a screen appeared,
 * because "a screen appeared" is not a fact about the application — it is a fact
 * about React, and a ViewModel that held an effect would be a ViewModel that
 * could not be read from Vue, from a server, or from `_playgrounds/node`.
 *
 * So this is view-layer glue and it lives with the module it serves. What it
 * calls is an ordinary action; what decides when to call it is the renderer.
 * That division is the one `ARCHITECTURE.md` draws at the top of its layer
 * table, and it is the reason this file is not under `ViewModels/`.
 *
 * The effect depends on `fetchMissions`, not on an empty array. An action is a
 * stable reference for the life of the store, so the effect runs once — and
 * saying so through the dependency means a future action rebuilt per render
 * would re-run it rather than silently go stale. `void` because a render cannot
 * await, and the ViewModel already owns what a failure means: the screen reads
 * `error`, it does not catch.
 */
export const useAtlasMissionsOnMount = (
	missionsVM: TAtlasMissionsVM,
): IAtlasMissionsState & IAtlasMissionsActions => {
	const missions = useAtlasMissions(missionsVM);
	const { fetchMissions } = missions;

	useEffect(() => {
		void fetchMissions();
	}, [fetchMissions]);

	return missions;
};
