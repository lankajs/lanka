import { createAtlasHost } from "@lanka-playgrounds/_shared/di";
import type { ILankaHost } from "lanka";

/**
 * What this application supplies to `lanka`.
 *
 * `import.meta.env` because Astro builds with vite on both sides, and a
 * `PUBLIC_`-prefixed variable is the one that reaches the browser. The base URL
 * is the build's, which is why it is read rather than written down.
 */
export const lankaHost: ILankaHost = createAtlasHost(
	import.meta.env.PUBLIC_ATLAS_API ?? "http://127.0.0.1:4380/api",
);
