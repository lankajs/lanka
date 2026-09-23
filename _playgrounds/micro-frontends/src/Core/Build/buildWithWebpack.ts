import { fileURLToPath } from "node:url";
import webpack from "webpack";
import { dropForeignSourceMaps } from "./dropForeignSourceMaps";
import { isProvidedByThePage } from "./isProvidedByThePage";
import { lankaDiAlias } from "../../../../../tools/testing/src/vitest";
import type { Configuration } from "webpack";
import type { IMicroFrontendBuild } from "./IMicroFrontendBuild";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

/** Where one pipeline's bundles land: `dist/webpack/<sharing>/`. */
const outputFor = (sharing: IMicroFrontendBuild["sharing"]): string =>
	fileURLToPath(new URL(`../../../dist/webpack/${sharing}/`, import.meta.url));

/**
 * The configuration another team's webpack pipeline would plausibly have.
 *
 * ## ESM out, because the page loads modules
 *
 * `outputModule` makes each bundle an ES module whose externals stay bare
 * `import` statements — the same shape a Vite library build produces, so the
 * shell loads either the same way and resolves `lanka` from the same place.
 *
 * ## One compilation, several separate bundles
 *
 * Unlike Rollup, webpack does not hoist what two ENTRIES share into a chunk
 * both load: with `splitChunks` off, every entry file carries its own copy of
 * every module it reaches, with its own runtime. So one compilation still
 * yields bundles that share nothing — which is what "built separately" means
 * for the page.
 *
 * ## Production mode, development semantics
 *
 * `production` for what it removes — unused exports and the comments of every
 * package the bundle reaches, which in development mode made each bundle nearly
 * five times its Vite twin — and `nodeEnv: "development"` for what it keeps: the
 * framework's development warnings, which the suites assert.
 *
 * ## esbuild for TypeScript, by extension
 *
 * No `loader` option: esbuild then picks `ts` or `tsx` from the file name. One
 * `tsx` for everything would read `<T>(x) => …` in a `.ts` file as JSX, and
 * lanka's own sources — bundled in `own-lanka` — have plenty of those.
 */
const configurationFor = ({ sharing, modules }: IMicroFrontendBuild): Configuration => ({
	mode: "production",
	context: ROOT,
	target: "web",
	devtool: false,
	entry: Object.fromEntries(modules.map(({ entry, name }) => [name, `./${entry}`])),
	experiments: { outputModule: true },
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
	resolve: {
		extensions: [".ts", ".tsx", ".mjs", ".js", ".svelte"],
		alias: lankaDiAlias(),
		conditionNames: ["svelte", "browser", "import", "module", "default"],
		mainFields: ["svelte", "browser", "module", "main"],
	},
	module: {
		rules: [
			{
				test: /\.[cm]?tsx?$/,
				loader: "esbuild-loader",
				options: { target: "es2022", jsx: "automatic" },
			},
			{
				test: /\.svelte$/,
				use: {
					loader: "svelte-loader",
					options: { emitCss: false, compilerOptions: { dev: true } },
				},
			},
			// Svelte's runtime imports its own files without extensions, which
			// webpack's ESM resolution refuses unless told this package is exempt.
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

/** Every module of one pipeline, in one webpack compilation — and the errors, if any. */
export const buildWithWebpack = (build: IMicroFrontendBuild): Promise<void> =>
	new Promise((resolve, reject) => {
		webpack(configurationFor(build), (error, stats) => {
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
