import {
	AtlasMissionGateway,
	atlasMissionAssigned,
	createAtlasMissionsVM,
} from "@lanka-playgrounds/_shared";
import { createRoot } from "react-dom/client";
import { createLankaVM } from "lanka/viewmodel";
import { defineLankaVM, resolveLankaVM } from "lanka/extend";
import { hydrateLankaVM } from "@lankajs/host";
import { useLankaVM } from "@lankajs/react";
import type { IAtlasMission } from "@lanka-playgrounds/_shared";
import type { JSX } from "react";
import type { TMissionsMount } from "../../Core/Mount/TMissionsMount";

/**
 * This module's own ViewModel, as a DEFINITION rather than an instance.
 *
 * A module built by one team and deployed on its own owns its screen, so it
 * builds its ViewModel rather than importing a shared one — every other module
 * does the same. A definition, so the instance can live in the scope the shell
 * hands over: the shell closes that scope when the module leaves, and the
 * ViewModel goes off the bus with it.
 */
const missions = defineLankaVM({
	name: "MissionsReactVM",
	build: () => createAtlasMissionsVM(new AtlasMissionGateway()),
});

/** The one mission this module's button assigns, so every scene can look for it. */
const CONVOY: IAtlasMission = {
	id: "m-1",
	code: "AT-101",
	title: "Escort the relay convoy",
	status: "queued",
	priority: 3,
	crewId: "c-1",
	updatedAt: "2026-09-23T00:00:00.000Z",
};

/**
 * The module's one WRITE: assigning the convoy, announced as a scenario.
 *
 * A scenario begins in a ViewModel action, not in a button — so the button
 * calls this, and the fact it announces is the only thing the other modules on
 * the page ever learn about it. Whether they share this module's lanka or run
 * their own behind a relay is not this module's concern.
 */
const assignment = defineLankaVM({
	name: "AssignmentReactVM",
	build: () =>
		createLankaVM<Record<never, never>, { assignConvoy: () => void }>({
			name: "AssignmentReactVM",
			states: {},
			createActions: () => ({
				assignConvoy: () => {
					atlasMissionAssigned.trigger({
						id: CONVOY.id,
						crewId: CONVOY.crewId,
						mission: CONVOY,
					});
				},
			}),
		}),
});

type TMissionsVM = ReturnType<typeof createAtlasMissionsVM>;

const MissionsReact = ({
	viewModel,
	assign,
}: {
	viewModel: TMissionsVM;
	assign: () => void;
}): JSX.Element => {
	const { rows } = useLankaVM(viewModel);

	return (
		<section aria-label="Missions in React">
			<button type="button" onClick={assign}>
				Assign the convoy
			</button>
			<ul>
				{rows().items.map((mission) => (
					<li key={mission.id}>{`${mission.code} ${mission.title}`}</li>
				))}
			</ul>
		</section>
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
export const mountMissionsReact: TMissionsMount = (element, { missions: rows, scope }) => {
	const viewModel = resolveLankaVM(missions, { scope });
	const writer = resolveLankaVM(assignment, { scope });
	hydrateLankaVM(viewModel, { missions: rows });

	const root = createRoot(element);
	root.render(
		<MissionsReact viewModel={viewModel} assign={() => writer.getState().assignConvoy()} />,
	);

	return () => root.unmount();
};
