import { buildWithVite } from "./buildWithVite";
import { buildWithWebpack } from "./buildWithWebpack";
import type { IMicroFrontendBuild } from "./IMicroFrontendBuild";

/**
 * One team's pipeline, run as that team would run it.
 *
 * Real builds, not a module graph reset in a test: what makes two copies of a
 * package is a bundler inlining it, and the only honest way to show that — or
 * to show two bundlers' output meeting on one page — is to let the bundlers do
 * it. Bundles land in `dist/<bundler>/<sharing>/<name>.js`.
 */
export const buildMicroFrontend = (build: IMicroFrontendBuild): Promise<void> =>
	build.bundler === "vite" ? buildWithVite(build) : buildWithWebpack(build);
