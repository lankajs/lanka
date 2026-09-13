import { notFound } from "next/navigation";
import { AtlasMissionForm } from "../../../src/Modules/AtlasMissionModule/AtlasMissionForm";
import { prerenderAtlasMissions } from "../../../src/Core/Server/prerenderAtlasMissions";
import type { JSX } from "react";

/**
 * Which missions are worth building ahead of time.
 *
 * `runLankaStatic`, through `prerenderAtlasMissions`: nobody is identified here
 * and the output is shared, so identity is REFUSED rather than forwarded — in
 * the types and again at runtime. It is a rebuild, not a visit.
 */
export async function generateStaticParams(): Promise<{ id: string }[]> {
	try {
		const missions = await prerenderAtlasMissions();

		return missions.map((mission) => ({ id: mission.id }));
	} catch (failure) {
		// A build must not die because a data source blinked. Prerendering NOTHING
		// is a complete answer — every path then renders on demand — while a failed
		// build is a deploy that does not happen.
		//
		// Reported rather than swallowed: "the board prerendered nothing" and "the
		// board has no missions" look identical in the output otherwise.
		console.warn("atlas: prerendering nothing — the API did not answer", failure);

		return [];
	}
}

/**
 * The host's own setting, not the framework's: lanka has no opinion on caching.
 *
 * It is also why this page reads NO headers. A page that asked for them would be
 * dynamic whatever this line said, and the two together would be a contradiction
 * a reader has to resolve: a shared file that is rebuilt on a timer cannot carry
 * one reader's session.
 */
export const revalidate = 3600;

export default async function MissionPage({
	params,
}: {
	params: Promise<{ id: string }>;
}): Promise<JSX.Element> {
	const { id } = await params;
	const missions = await prerenderAtlasMissions();
	const mission = missions.find((one) => one.id === id);

	if (!mission) notFound();

	return (
		<main>
			<h1>{mission.code}</h1>
			<AtlasMissionForm mission={mission} />
		</main>
	);
}
