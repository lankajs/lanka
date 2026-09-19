import { atlasIslandMissionsVM } from "./atlasIslandMissionsVM";
import { AtlasMissionSearch } from "@lanka-playgrounds/react-shared/dom";
import { formatAtlasMissionLine, useAtlasHydratedMissions } from "@lanka-playgrounds/react-shared";
import type { IAtlasMission } from "@lanka-playgrounds/_shared";
import type { JSX } from "react";

export interface IAtlasBoardIslandProps {
	/** What the `.astro` page fetched, as an ordinary prop. */
	missions: readonly IAtlasMission[];
}

/**
 * The interactive half of a page that was rendered on the server.
 *
 * An island needs NOTHING from `@lankajs/host` that the Next application did not
 * need — which is why the call is not here at all: it is in
 * `@lanka-playgrounds/react-shared`, and this file and Next's client component
 * import the same hook.
 *
 * That the two are byte-identical below the ecosystem package is the claim Astro
 * is here to make. The host differs — a different bundler, a different rendering
 * mode, a page that is not React at all — and the React inside it does not.
 */
export const AtlasBoardIsland = ({ missions }: IAtlasBoardIslandProps): JSX.Element => {
	const { rows, applySearch, search } = useAtlasHydratedMissions(atlasIslandMissionsVM, missions);

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
