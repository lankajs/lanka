import { createAtlasHost } from "@lanka-playgrounds/_shared/di";
import type { ILankaHost } from "lanka";

/**
 * What this application supplies to `lanka`.
 *
 * `process.env` rather than a bundler global, because this file is read on BOTH
 * sides: a server component resolves it in node, and a client component resolves
 * it in a browser. Next inlines a `NEXT_PUBLIC_` variable into the browser
 * bundle, which is what makes one file able to answer for both.
 */
export const lankaHost: ILankaHost = createAtlasHost(
	process.env.NEXT_PUBLIC_ATLAS_API ?? "http://127.0.0.1:4380/api",
);
