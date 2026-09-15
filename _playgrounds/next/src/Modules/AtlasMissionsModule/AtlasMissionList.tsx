"use client";

import { useLankaVM } from "@lankajs/react";

import { hydrateLankaVM } from "@lankajs/host";
import { createAtlasMissionsVM, AtlasMissionGateway } from "@lanka-playgrounds/_shared";
import type { IAtlasMission } from "@lanka-playgrounds/_shared";
import type { JSX } from "react";

export interface IAtlasMissionListProps {
	/** What the server fetched, as an ordinary prop. */
	missions: readonly IAtlasMission[];
}

/**
 * The ViewModel, built once for this browser tab.
 *
 * At module level deliberately, and only in a CLIENT component: a ViewModel is a
 * zustand store, so one module means one store per process — which in a browser
 * is one per tab and on a server would be one shared by every user connected to
 * it. That is the whole reason this file carries `"use client"`.
 */
const missionsVM = createAtlasMissionsVM(new AtlasMissionGateway());

/**
 * The board, starting from what the server already had.
 *
 * The handoff is DATA, not state: the page fetched through a gateway inside a
 * scope, handed the result down as a prop, and `hydrateLankaVM` makes it the
 * ViewModel's first state. There is no second request from the browser for what
 * the HTML already contained.
 *
 * `hydrateLankaVM` applies ONCE per store. A later call does nothing — not a
 * throw, because React renders a component twice in StrictMode and again on
 * every re-render, and a throw would turn correct code into a crash visible only
 * in development. Changing hydrated state is an action's job.
 */
export const AtlasMissionList = ({ missions }: IAtlasMissionListProps): JSX.Element => {
	hydrateLankaVM(missionsVM, { missions });
	const { rows, applySearch, search } = useLankaVM(missionsVM);

	return (
		<section aria-label="Missions">
			<input
				aria-label="Search missions"
				value={search}
				onChange={(event) => applySearch(event.target.value)}
			/>
			<ul>
				{rows().items.map((mission) => (
					// One text node rather than three. `{code} {title}` renders as
					// separate children, which is invisible on screen and means a
					// reader — a test, a screen reader — cannot match the line.
					<li key={mission.id}>{`${mission.code} ${mission.title}`}</li>
				))}
			</ul>
		</section>
	);
};
