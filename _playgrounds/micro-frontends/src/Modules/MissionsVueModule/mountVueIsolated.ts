import { atlasMissionAssigned } from "@lanka-playgrounds/_shared";
import { mountIsolated } from "../../Core/Isolation/mountIsolated";
import { mountMissionsVue } from "./mountMissionsVue";
import type { IAtlasMission } from "@lanka-playgrounds/_shared";

/** The Vue module, running its own lanka, receiving the assignment only. */
export const mountVueIsolated = (
	element: Element,
	missions: readonly IAtlasMission[],
): Promise<() => void> =>
	mountIsolated(mountMissionsVue, element, missions, {
		receive: [atlasMissionAssigned.eventType],
	});
