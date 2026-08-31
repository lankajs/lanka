import { lankaDiContract } from "../lanka-di-contract/lankaDiContract";
import { lankaDiScaffoldNotice } from "../lanka-di-scaffold-notice/lankaDiScaffoldNotice";
import { lankaDiSetup } from "../lanka-di-setup/lankaDiSetup";
import type { ILankaDiPluginOptions } from "../_interfaces/ILankaDiPluginOptions";

/** The part of esbuild's build API this plugin touches. */
export interface ILankaEsbuildBuild {
	onStart: (callback: () => void) => void;
	onResolve: (
		options: { filter: RegExp },
		callback: (args: { path: string }) => { path: string } | undefined,
	) => void;
}

/** What esbuild takes in `plugins`. */
export interface ILankaEsbuildPlugin {
	readonly name: string;
	setup: (build: ILankaEsbuildBuild) => void;
}

/**
 * The same contract for esbuild.
 *
 * `onStart` is where the verification goes — it runs once per build and once per
 * rebuild in watch mode, which is the closest esbuild has to the hook the other
 * adapters use. `onResolve` is the alias: esbuild has no alias map, and a
 * resolver answering the file is the same thing said differently.
 *
 * ```js
 * import { lankaDiEsbuild } from "@lankajs/tool-di/esbuild";
 *
 * await esbuild.build({ plugins: [lankaDiEsbuild({ scaffold: !process.env.CI })] });
 * ```
 */
export const lankaDiEsbuild = (options: ILankaDiPluginOptions = {}): ILankaEsbuildPlugin => {
	const setup = lankaDiSetup(options);
	const prefix = `${lankaDiContract.alias}/`;

	return {
		name: "lanka:di",

		setup(build) {
			build.onStart(() => {
				const created = setup.verify();
				// esbuild's `onStart` may return warnings, but a plugin that returns
				// them has to return them on EVERY path — including the throwing one,
				// where there is nothing to return. `console` keeps the two apart.
				if (created.length > 0) console.warn(lankaDiScaffoldNotice(created));
			});

			// Anchored on the alias and nothing else: a filter of `/lanka/` would
			// claim every import with the framework's name in it, including the
			// framework's own.
			build.onResolve({ filter: new RegExp(`^${lankaDiContract.alias}/`) }, (args) => ({
				path: `${setup.dir}/${args.path.slice(prefix.length)}.ts`,
			}));
		},
	};
};
