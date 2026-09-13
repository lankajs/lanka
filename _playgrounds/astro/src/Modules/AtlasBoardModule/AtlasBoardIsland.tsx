import { hydrateLankaVM } from "@lankajs/host";
import { AtlasMissionGateway, createAtlasMissionsVM } from "@lanka-playgrounds/_shared";
import type { IAtlasMission } from "@lanka-playgrounds/_shared";
import type { JSX } from "react";

export interface IAtlasBoardIslandProps {
	/** What the `.astro` page fetched, as an ordinary prop. */
	missions: readonly IAtlasMission[];
}

/**
 * The ViewModel, built once per browser tab.
 *
 * At module level and only reachable from an ISLAND, which is Astro's word for
 * "a client component": a ViewModel is a zustand store, so one module means one
 * store per process. In a browser that is one per tab; on a server it would be
 * one shared by everybody.
 */
const useMissionsVM = createAtlasMissionsVM(new AtlasMissionGateway());

/**
 * The interactive half of a page that was rendered on the server.
 *
 * An island needs NOTHING from `@lankajs/host` except this one call: the page
 * fetched through a gateway inside a scope, handed the result down as a prop,
 * and `hydrateLankaVM` makes it the first state this screen reads. There is no
 * second request for what the HTML already contained.
 */
export const AtlasBoardIsland = ({ missions }: IAtlasBoardIslandProps): JSX.Element => {
	hydrateLankaVM(useMissionsVM, { missions });
	const { rows, applySearch, search } = useMissionsVM();

	return (
		<section aria-label="Missions">
			<input
				aria-label="Search missions"
				value={search}
				onChange={(event) => applySearch(event.target.value)}
			/>
			<ul>
				{rows().items.map((mission) => (
					<li key={mission.id}>{`${mission.code} ${mission.title}`}</li>
				))}
			</ul>
		</section>
	);
};
