/** @jsxImportSource solid-js */
import { For, createSignal } from "solid-js";
import { AtlasMissionGateway, createAtlasMissionsVM } from "@lanka-playgrounds/_shared";
import { formatAtlasMissionLine, useAtlasMissions } from "@lanka-playgrounds/solid-shared";
import { hydrateLankaVM } from "@lankajs/host";
import type { IAtlasMission } from "@lanka-playgrounds/_shared";

/**
 * The ViewModel, built once per browser tab.
 *
 * At module level and only reachable from an ISLAND, which is Astro's word for
 * "a client component": one module means one store per process, and for an
 * island that process is a browser tab.
 */
const missionsVM = createAtlasMissionsVM(new AtlasMissionGateway());

export interface IAtlasBoardIslandSolidProps {
	/** What the `.astro` page fetched, as an ordinary prop. */
	missions: readonly IAtlasMission[];
}

/**
 * The same island, in Solid.
 *
 * ## The pragma on line one is the whole trick
 *
 * This page has a React island and a Solid island in the same project, and
 * `jsx`/`jsxImportSource` are per-PROGRAM: without that line TypeScript checks
 * this file under React's setting, types every element as `React.JSX.Element`
 * and rejects all of them. The repository's root tsconfig EXCLUDES
 * `modules/bindings/solid` for the same reason; here the file itself says which
 * dialect it is, which is the only way two can share one program.
 *
 * Astro needs the same disambiguation at build time, and `astro.config.mjs`
 * gives each JSX integration an `include` glob for it.
 */
export const AtlasBoardIslandSolid = (props: IAtlasBoardIslandSolidProps) => {
	hydrateLankaVM(missionsVM, { missions: props.missions });

	const missions = useAtlasMissions(missionsVM);
	const [search, setSearch] = createSignal("");

	return (
		<section aria-label="Missions in Solid">
			<input
				aria-label="Search Solid missions"
				value={search()}
				onInput={(event) => {
					setSearch(event.currentTarget.value);
					missions().applySearch(event.currentTarget.value);
				}}
			/>
			<ul>
				<For each={missions().rows().items}>
					{(row) => <li>{formatAtlasMissionLine(row)}</li>}
				</For>
			</ul>
		</section>
	);
};
