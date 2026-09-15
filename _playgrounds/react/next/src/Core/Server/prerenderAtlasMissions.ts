import { lankaGateways } from "lanka/locator";
import { runLankaStatic } from "@lankajs/host/server";
import { atlasApiBaseUrl } from "./atlasApiBaseUrl";
import type { IAtlasMission } from "@lanka-playgrounds/_shared";

/**
 * The same board, for output that is SHARED by everybody.
 *
 * The other server call, and the difference between the two is the only thing
 * that differs: `runLankaStatic` refuses identity — in the types and again at
 * runtime. A cookie forwarded during a build bakes one reader's data into a file
 * served to everyone; the build succeeds, and the page looks right to whoever
 * ran it.
 *
 * This is what a prerendered route, `generateStaticParams` and an ISR
 * revalidation all use, because all three are a REBUILD rather than a visit.
 */
export const prerenderAtlasMissions = (): Promise<IAtlasMission[]> =>
	runLankaStatic({ apiBaseUrl: atlasApiBaseUrl() }, () =>
		lankaGateways.atlasMissionGateway.list(),
	);
