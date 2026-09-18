import { createAtlasHost } from "@lanka-playgrounds/_shared/di";
import { atlasApiBaseUrl } from "../src/Core/Server/atlasApiBaseUrl";
import type { ILankaHost } from "lanka";

/**
 * What this application supplies to `lanka`.
 *
 * The same host the application starts with, so there is ONE place that decides
 * what a failure says. A second copy here would be a second answer to the same
 * question, and the two would disagree the first time somebody edited one.
 *
 * ## `atlasApiBaseUrl()` and not `import.meta.env`, unlike the SPA's barrel
 *
 * The SPA reads `import.meta.env.VITE_ATLAS_API`, because a browser bundle has
 * no other way to be told anything. This barrel is read on a SERVER — by a
 * `load` function, through `lanka/locator` — and a `VITE_`-prefixed variable is
 * one the build substitutes into public output. Reading it here would work and
 * would mean the API's address is public whether or not it should be, which is
 * the kind of correct-by-accident that stops being correct on the day the
 * address is internal.
 *
 * A function call rather than a constant for the reason that file states: a
 * module-level read happens once per PROCESS, and a server process outlives a
 * configuration change.
 *
 * `/di` and not the package's main barrel, like every other `.lanka_di` file
 * here. The framework READS these barrels from inside `lanka/locator`, so
 * whatever they import is pulled in while the locator is still evaluating — and
 * the main barrel reaches the whole application from there. A bundler hides that
 * as often as it does not, which is the worse of the two outcomes.
 */
export const lankaHost: ILankaHost = createAtlasHost(atlasApiBaseUrl());
