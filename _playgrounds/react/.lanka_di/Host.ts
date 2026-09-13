import { createAtlasHost } from "@lanka-playgrounds/_shared";
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
 */
export const lankaHost: ILankaHost = createAtlasHost(
	import.meta.env.VITE_ATLAS_API ?? "http://127.0.0.1:4380/api",
);
