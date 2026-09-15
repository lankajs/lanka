import { headers } from "next/headers";
import { AtlasMissionList } from "../../src/Modules/AtlasMissionsModule/AtlasMissionList";
import { readAtlasMissions } from "../../src/Core/Server/readAtlasMissions";
import type { JSX } from "react";

/**
 * The board, rendered on the server for whoever asked for it.
 *
 * A server component: it awaits a gateway inside a request scope and hands the
 * result down as an ordinary prop. What it does NOT do is touch a ViewModel —
 * that is module state, and module state here is one store shared by every
 * reader connected to this process.
 */
export default async function MissionsPage(): Promise<JSX.Element> {
	const missions = await readAtlasMissions(await headers());

	return (
		<main>
			<h1>The board</h1>
			<AtlasMissionList missions={missions} />
		</main>
	);
}
