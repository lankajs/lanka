import { AtlasMissionGateway, createAtlasMissionsVM } from "@lanka-playgrounds/_shared";
import { createRoot } from "react-dom/client";
import { hydrateLankaVM } from "@lankajs/host";
import { useLankaVM } from "@lankajs/react";
import type { IAtlasMission } from "@lanka-playgrounds/_shared";
import type { JSX } from "react";

/**
 * This module's own ViewModel, and nobody else's.
 *
 * A module built by one team and deployed on its own owns its screen, so it
 * builds its ViewModel rather than importing a shared instance — the Vue module
 * beside it does the same. What links the two is a scenario on the bus, which
 * is the one thing that has to be common: see the suite.
 */
const missionsVM = createAtlasMissionsVM(new AtlasMissionGateway());

const MissionsReact = (): JSX.Element => {
	const { rows } = useLankaVM(missionsVM);

	return (
		<ul aria-label="Missions in React">
			{rows().items.map((mission) => (
				<li key={mission.id}>{`${mission.code} ${mission.title}`}</li>
			))}
		</ul>
	);
};

/**
 * What the shell calls: an element, and the rows the shell already has.
 *
 * The whole contract of a separately built module is this function. The shell
 * does not import React, does not know what renders inside the element, and
 * gets back the one thing it needs — a way to take the module off the page.
 */
export const mountMissionsReact = (
	element: Element,
	missions: readonly IAtlasMission[],
): (() => void) => {
	hydrateLankaVM(missionsVM, { missions });

	const root = createRoot(element);
	root.render(<MissionsReact />);

	return () => root.unmount();
};
