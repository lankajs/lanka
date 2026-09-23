import { atlasMissionAssigned } from "@lanka-playgrounds/_shared";
import { mountIsolated } from "../../Core/Isolation/mountIsolated";
import { mountMissionsAngular } from "./mountMissionsAngular";
import type { IAtlasMission } from "@lanka-playgrounds/_shared";

/** The Angular module, running its own lanka, receiving the assignment only. */
export const mountAngularIsolated = (
	element: Element,
	missions: readonly IAtlasMission[],
): Promise<() => void> =>
	mountIsolated(mountMissionsAngular, element, missions, {
		receive: [atlasMissionAssigned.eventType],
	});
