import { AtlasMissionGateway, createAtlasMissionsVM } from "@lanka-playgrounds/_shared";
import { createRoot } from "react-dom/client";
import { defineLankaVM, resolveLankaVM } from "lanka/extend";
import { hydrateLankaVM } from "@lankajs/host";
import { useLankaVM } from "@lankajs/react";
import type { IMissionsMount } from "../../Core/Mount/IMissionsMount";
import type { JSX } from "react";

/**
 * This module's own ViewModel, as a DEFINITION rather than an instance.
 *
 * A module built by one team and deployed on its own owns its screen, so it
 * builds its ViewModel rather than importing a shared one — the Vue module beside
 * it does the same. A definition, so the instance can live in the scope the shell
 * hands over: the shell closes that scope when the module leaves, and the
 * ViewModel goes off the bus with it.
 */
const missions = defineLankaVM({
	name: "MissionsReactVM",
	build: () => createAtlasMissionsVM(new AtlasMissionGateway()),
});

const MissionsReact = ({
	viewModel,
}: {
	viewModel: ReturnType<typeof createAtlasMissionsVM>;
}): JSX.Element => {
	const { rows } = useLankaVM(viewModel);

	return (
		<ul aria-label="Missions in React">
			{rows().items.map((mission) => (
				<li key={mission.id}>{`${mission.code} ${mission.title}`}</li>
			))}
		</ul>
	);
};

/**
 * What the shell calls: an element, the rows the shell already has, and the
 * scope this module's screen lives in.
 *
 * The whole contract of a separately built module is this function. The shell
 * does not import React, does not know what renders inside the element, and
 * gets back the one thing it needs — a way to take the module off the page.
 */
export const mountMissionsReact = (
	element: Element,
	{ missions: rows, scope }: IMissionsMount,
): (() => void) => {
	const viewModel = resolveLankaVM(missions, { scope });
	hydrateLankaVM(viewModel, { missions: rows });

	const root = createRoot(element);
	root.render(<MissionsReact viewModel={viewModel} />);

	return () => root.unmount();
};
