import { onMounted } from "vue";
import { useAtlasMissions } from "./useAtlasMissions";
import type { TAtlasMissionsVM } from "./useAtlasMissions";
import type { ILankaVMRef } from "@lankajs/vue";
import type { IAtlasMissionsActions, IAtlasMissionsState } from "@lanka-playgrounds/_shared";

/**
 * Read the missions ViewModel, and ask it for data once the screen exists.
 *
 * The pattern a client-only screen uses, and the Vue half of what
 * `@lanka-playgrounds/react-shared` calls `useAtlasMissionsOnMount` — same
 * sentence, different lifecycle hook.
 *
 * ## The effect is in the VIEW, and that is where it has to be
 *
 * A ViewModel owns state and actions. It does not know that a screen appeared,
 * because "a screen appeared" is not a fact about the application — it is a fact
 * about Vue, and a ViewModel holding one could not be read from React, from a
 * server, or from `_playgrounds/node`.
 *
 * `onMounted` and not `watchEffect`: the fetch happens ONCE, when the screen
 * exists, and a reactive effect would re-run it for reasons the screen did not
 * ask about. `void` because the hook cannot await, and the ViewModel already
 * owns what a failure means — the screen reads `error`, it does not catch.
 */
export const useAtlasMissionsOnMount = (
	missionsVM: TAtlasMissionsVM,
): ILankaVMRef<IAtlasMissionsState & IAtlasMissionsActions> => {
	const missions = useAtlasMissions(missionsVM);

	onMounted(() => {
		void missions.value.fetchMissions();
	});

	return missions;
};
