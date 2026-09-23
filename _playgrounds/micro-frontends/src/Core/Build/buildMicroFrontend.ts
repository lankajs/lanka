import { buildWithRspack } from "./buildWithRspack";
import { buildWithVite } from "./buildWithVite";
import { buildWithWebpack } from "./buildWithWebpack";
import type { IMicroFrontendBuild, TMicroFrontendBundler } from "./IMicroFrontendBuild";

/** One builder per bundler: a table, so a fourth bundler is a row the compiler asks for. */
const BUILDERS: Readonly<
	Record<TMicroFrontendBundler, (build: IMicroFrontendBuild) => Promise<void>>
> = Object.freeze({
	vite: buildWithVite,
	webpack: buildWithWebpack,
	rspack: buildWithRspack,
});

/**
 * One team's pipeline, run as that team would run it.
 *
 * Real builds, not a module graph reset in a test: what makes two copies of a
 * package is a bundler inlining it, and the only honest way to show that — or
 * to show several bundlers' output meeting on one page — is to let the bundlers
 * do it. Bundles land in `dist/<bundler>/<sharing>/<name>.js`.
 */
export const buildMicroFrontend = (build: IMicroFrontendBuild): Promise<void> =>
	BUILDERS[build.bundler](build);
