"use client";

import { AtlasMissionSearch } from "@lanka-playgrounds/react-shared/dom";
import { createAtlasMissionsVM, AtlasMissionGateway } from "@lanka-playgrounds/_shared";
import { formatAtlasMissionLine, useAtlasHydratedMissions } from "@lanka-playgrounds/react-shared";
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
 * store, so one module means one store per process — which in a browser is one
 * per tab and on a server would be one shared by every user connected to it.
 * That is the whole reason this file carries `"use client"`.
 */
const missionsVM = createAtlasMissionsVM(new AtlasMissionGateway());

/**
 * The board, starting from what the server already had.
 *
 * Three lines of this screen are the React ecosystem's and not Next's — the
 * hydrating read, the search box and the line format — so they live in
 * `@lanka-playgrounds/react-shared` and the Astro island imports the same three.
 * What is left here is the part that IS Next: `"use client"`, and a module-level
 * store that only a client bundle may hold.
 */
export const AtlasMissionList = ({ missions }: IAtlasMissionListProps): JSX.Element => {
	const { rows, applySearch, search } = useAtlasHydratedMissions(missionsVM, missions);

	return (
		<section aria-label="Missions">
			<AtlasMissionSearch search={search} onSearch={applySearch} />
			<ul>
				{rows().items.map((mission) => (
					<li key={mission.id}>{formatAtlasMissionLine(mission)}</li>
				))}
			</ul>
		</section>
	);
};
