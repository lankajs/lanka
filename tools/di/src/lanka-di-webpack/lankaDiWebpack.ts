import { lankaDiScaffoldNotice } from "../lanka-di-scaffold-notice/lankaDiScaffoldNotice";
import { lankaDiSetup } from "../lanka-di-setup/lankaDiSetup";
import type { ILankaDiPluginOptions } from "../_interfaces/ILankaDiPluginOptions";

/**
 * The part of webpack's `Compiler` this plugin touches, and nothing else.
 *
 * A structural type rather than `import type { Compiler } from "webpack"`, and
 * the difference is not stylistic: an import would make webpack a peer
 * dependency of a package most consumers install for vite, and every one of them
 * would answer a warning about a bundler they do not use. What the plugin needs
 * is four members, and a real `Compiler` satisfies them.
 */
export interface ILankaWebpackCompiler {
	options: { resolve?: { alias?: Record<string, unknown> } };
	context?: string;
	hooks: {
		beforeRun: { tapAsync: (name: string, fn: TLankaWebpackHook) => void };
		watchRun: { tapAsync: (name: string, fn: TLankaWebpackHook) => void };
	};
	getInfrastructureLogger?: (name: string) => { warn: (message: string) => void };
}

/** What webpack hands an async hook: the compiler, and a callback to finish with. */
export type TLankaWebpackHook = (compiler: unknown, callback: (error?: Error) => void) => void;

/** What `lankaDiWebpack()` answers: an object webpack calls `apply` on. */
export interface ILankaWebpackPlugin {
	apply: (compiler: ILankaWebpackCompiler) => void;
}

const PLUGIN_NAME = "lanka:di";

/**
 * The same three jobs as the vite plugin, for webpack.
 *
 * The alias, scaffolding for the barrels, and a verification that fails the
 * BUILD rather than letting a missing export resolve to `undefined` inside the
 * locator at runtime. What each of those is for is in the contract module; this
 * file is only how webpack is told about them.
 *
 * ## Where it hooks, and why not `beforeCompile`
 *
 * `beforeRun` and `watchRun` fire once per run and once per watch cycle;
 * `beforeCompile` fires for every rebuild, which in a dev server means reading
 * six files on every keystroke to learn what it learnt a second ago. The
 * verification runs ONCE per process for the same reason — the barrels are the
 * application's own source, and a developer who edits one is served by the type
 * checker long before this plugin would notice.
 *
 * ## Failing
 *
 * A problem is passed to webpack's callback, which fails the build with that
 * message. Scaffolding is a warning through the infrastructure logger, because a
 * file that was written is not an error — it is a file to commit.
 *
 * @example
 * ```js
 * const { lankaDiWebpack } = require("@lankajs/tool-di/webpack");
 *
 * module.exports = {
 *   plugins: [lankaDiWebpack({ scaffold: !process.env.CI })],
 * };
 * ```
 */
export const lankaDiWebpack = (options: ILankaDiPluginOptions = {}): ILankaWebpackPlugin => ({
	apply(compiler) {
		const setup = lankaDiSetup({ ...options, root: options.root ?? compiler.context });

		compiler.options.resolve ??= {};
		compiler.options.resolve.alias = { ...compiler.options.resolve.alias, ...setup.alias };

		let verified = false;

		const verify: TLankaWebpackHook = (_compiler, callback) => {
			if (verified) return callback();
			verified = true;

			try {
				const created = setup.verify();
				if (created.length > 0) {
					compiler
						.getInfrastructureLogger?.(PLUGIN_NAME)
						.warn(lankaDiScaffoldNotice(created));
				}
			} catch (failure) {
				return callback(failure instanceof Error ? failure : new Error(String(failure)));
			}

			return callback();
		};

		compiler.hooks.beforeRun.tapAsync(PLUGIN_NAME, verify);
		compiler.hooks.watchRun.tapAsync(PLUGIN_NAME, verify);
	},
});
