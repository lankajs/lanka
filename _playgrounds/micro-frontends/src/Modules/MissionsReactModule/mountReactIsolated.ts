import { atlasMissionAssigned } from "@lanka-playgrounds/_shared";
import { mountIsolated } from "../../Core/Isolation/mountIsolated";
import { mountMissionsReact } from "./mountMissionsReact";
import type { IAtlasMission } from "@lanka-playgrounds/_shared";

/**
 * The React module, running its own lanka, and both SENDING and receiving the
 * assignment — its button is where the page's one write starts, and it repaints
 * from what arrives back like every other module.
 */
export const mountReactIsolated = (
	element: Element,
	missions: readonly IAtlasMission[],
): Promise<() => void> =>
	mountIsolated(mountMissionsReact, element, missions, {
		send: [atlasMissionAssigned.eventType],
		receive: [atlasMissionAssigned.eventType],
	});
