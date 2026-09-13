import { lankaGateways } from "lanka/locator";
import { runLankaRequest } from "@lankajs/host/server";
import type { IAtlasMission } from "@lanka-playgrounds/_shared";

/** Where the API lives, as this build's environment says. */
const apiBaseUrl = (): string => import.meta.env.PUBLIC_ATLAS_API ?? "http://127.0.0.1:4380/api";

/**
 * The board, read inside an Astro page's frontmatter.
 *
 * The same call the Next application makes, under a different bundler and a
 * different renderer — which is the whole reason this fourth application exists:
 * `@lankajs/host` is a seam, not a Next adapter. An island is a client component
 * and needs nothing from this package; only the `.astro` page that FETCHES does.
 *
 * `Astro.request.headers` is a `Headers` object and is read directly, exactly as
 * Next's `headers()` is.
 */
export const readAtlasBoard = (headers: Headers): Promise<IAtlasMission[]> =>
	runLankaRequest({ apiBaseUrl: apiBaseUrl(), headers }, () =>
		lankaGateways.atlasMissionGateway.list(),
	);
