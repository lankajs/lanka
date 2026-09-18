import { createAtlasHost } from "@lanka-playgrounds/_shared/di";
import type { ILankaHost } from "lanka";

/**
 * What this application supplies to `lanka`.
 *
 * `process.env` rather than `import.meta.env`, because this file is read on BOTH
 * sides: a Nitro route resolves it in node, and the component resolves it in a
 * browser. Nuxt exposes a `NUXT_PUBLIC_` variable to the client through its
 * runtime config, which is what makes one file able to answer for both — and it
 * is the same reason the Next application here reads `process.env` too.
 *
 * `/di` and not the package's main barrel, like every other `.lanka_di` file.
 * The framework READS these barrels from inside `lanka/locator`, so whatever
 * they import is pulled in while the locator is still evaluating — and the main
 * barrel reaches the whole application from there.
 */
export const lankaHost: ILankaHost = createAtlasHost(
	process.env.NUXT_ATLAS_API ?? "http://127.0.0.1:4380/api",
);
