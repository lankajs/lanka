import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { rspack } from "@rspack/core";
import { lankaDiWebpack } from "@lankajs/tool-di/webpack";
import { dropForeignSourceMaps } from "./dropForeignSourceMaps";
import { isProvidedByThePage } from "./isProvidedByThePage";
import type { Configuration, RuleSetRule } from "@rspack/core";
import type { IMicroFrontendBuild } from "./IMicroFrontendBuild";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

/**
 * Where the pipeline's `@lanka_di` barrels live: a root of their own, inside
 * `dist/`, emptied before every build.
 *
 * Not the test kit's fixture the other two bundlers alias to, because the claim
 * here is `@lankajs/tool-di`'s: its webpack plugin, handed to Rspack unchanged,
 * sets the alias AND scaffolds the barrels. Barrels found in a directory the
 * build emptied first can only have been written by the plugin.
 */
const RSPACK_BARRELS = fileURLToPath(new URL("../../../dist/rspack/barrels/", import.meta.url));

/** Where one pipeline's bundles land: `dist/rspack/<sharing>/`. */
const outputFor = (sharing: IMicroFrontendBuild["sharing"]): string =>
	fileURLToPath(new URL(`../../../dist/rspack/${sharing}/`, import.meta.url));

/**
 * TypeScript through Rspack's own swc, one rule per syntax.
 *
 * Two rules for the reason the webpack pipeline lets esbuild pick by extension:
 * one `tsx` parser for everything would read `<T>(x) => …` in a `.ts` file as
 * JSX, and lanka's own sources — bundled in `own-lanka` — have plenty of those.
 */
const swc = (tsx: boolean): RuleSetRule => ({
	test: tsx ? /\.tsx$/ : /\.[cm]?ts$/,
	loader: "builtin:swc-loader",
	type: "javascript/auto",
	options: {
		jsc: {
			parser: { syntax: "typescript", tsx },
			target: "es2022",
			...(tsx ? { transform: { react: { runtime: "automatic" } } } : {}),
		},
	},
});

/**
 * The configuration a team on Rspack would plausibly have: the webpack
 * pipeline's, translated where Rspack differs and nowhere else.
 *
 * Rspack is webpack's API over a different engine, so everything that
 * `buildWithWebpack` explains holds here — ESM out, one compilation of
 * separate bundles, production mode with development semantics. The two
 * translations are TypeScript, which goes through Rspack's built-in swc rather
 * than a loader, and `@lanka_di`, which goes through `@lankajs/tool-di`'s
 * webpack plugin — the one a consumer on Rspack is told to use — rather than an
 * alias to the test kit's fixture. See `RSPACK_BARRELS`.
 */
const configurationFor = ({ sharing, modules }: IMicroFrontendBuild): Configuration => ({
	mode: "production",
	context: ROOT,
	target: "web",
	devtool: false,
	entry: Object.fromEntries(modules.map(({ entry, name }) => [name, `./${entry}`])),
	output: {
		path: outputFor(sharing),
		filename: "[name].js",
		module: true,
		chunkFormat: "module",
		library: { type: "module" },
	},
	externalsType: "module",
	externals: [
		({ request }, callback) => {
			if (request && isProvidedByThePage(request, sharing)) callback(undefined, request);
			else callback();
		},
	],
	plugins: [lankaDiWebpack({ root: RSPACK_BARRELS })],
	resolve: {
		extensions: [".ts", ".tsx", ".mjs", ".js", ".svelte"],
		conditionNames: ["svelte", "browser", "import", "module", "default"],
		mainFields: ["svelte", "browser", "module", "main"],
	},
	module: {
		rules: [
			swc(false),
			swc(true),
			{
				test: /\.svelte$/,
				use: {
					loader: "svelte-loader",
					options: { emitCss: false, compilerOptions: { dev: true } },
				},
			},
			// As under webpack: Svelte's runtime imports its own files without
			// extensions, which ESM resolution refuses unless this package is exempt.
			{
				test: /[\\/]node_modules[\\/]svelte[\\/].*\.m?js$/,
				resolve: { fullySpecified: false },
			},
		],
	},
	optimization: {
		minimize: false,
		splitChunks: false,
		runtimeChunk: false,
		nodeEnv: "development",
	},
	performance: { hints: false },
	stats: "errors-only",
});

/** Every module of one pipeline, in one Rspack compilation — and the errors, if any. */
export const buildWithRspack = (build: IMicroFrontendBuild): Promise<void> =>
	new Promise((resolve, reject) => {
		rmSync(RSPACK_BARRELS, { recursive: true, force: true });
		rspack(configurationFor(build), (error, stats) => {
			if (error) {
				reject(error);
				return;
			}
			if (stats?.hasErrors()) {
				reject(new Error(stats.toString("errors-only")));
				return;
			}
			dropForeignSourceMaps(outputFor(build.sharing), build.modules);
			resolve();
		});
	});
