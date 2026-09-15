import { createAtlasHost } from "@lanka-playgrounds/_shared/di";
import type { ILankaHost } from "lanka";

/**
 * What this application supplies to `lanka`.
 *
 * The same host the application starts with, so there is ONE place that decides
 * what a failure says. A second copy here would be a second answer to the same
 * question, and the two would disagree the first time somebody edited one.
 *
 * The base URL is the build's, which is why it is read from the environment and
 * not written down: the framework cannot know your bundler, and a value baked in
 * here is a value that is wrong in production.
 *
 * `/di` and not the package's main barrel, like every other `.lanka_di` file
 * here. The framework READS these barrels from inside `lanka/locator`, so
 * whatever they import is pulled in while the locator is still evaluating — and
 * the main barrel reaches the whole application from there. A bundler hides that
 * as often as it does not, which is the worse of the two outcomes.
 */
export const lankaHost: ILankaHost = createAtlasHost(
	import.meta.env.VITE_ATLAS_API ?? "http://127.0.0.1:4380/api",
);
