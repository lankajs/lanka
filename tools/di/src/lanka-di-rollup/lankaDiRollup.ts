import { lankaDiContract } from "../lanka-di-contract/lankaDiContract";
import { lankaDiScaffoldNotice } from "../lanka-di-scaffold-notice/lankaDiScaffoldNotice";
import { lankaDiSetup } from "../lanka-di-setup/lankaDiSetup";
import type { ILankaDiPluginOptions } from "../_interfaces/ILankaDiPluginOptions";

/** The rollup plugin shape, as far as this plugin fills it. */
export interface ILankaRollupPlugin {
	readonly name: string;
	buildStart: (this: { warn: (message: string) => void }) => void;
	resolveId: (source: string) => string | null;
}

/**
 * The same contract for a plain rollup build.
 *
 * Rollup has no `resolve.alias`, so the alias is a `resolveId` that answers the
 * file itself — which is what an alias IS, said in rollup's vocabulary. A
 * consumer already using `@rollup/plugin-alias` can skip this and spread
 * `lankaDiSetup().alias` into it instead.
 *
 * ```js
 * import { lankaDiRollup } from "@lankajs/tool-di/rollup";
 *
 * export default { plugins: [lankaDiRollup({ scaffold: !process.env.CI })] };
 * ```
 */
export const lankaDiRollup = (options: ILankaDiPluginOptions = {}): ILankaRollupPlugin => {
	const setup = lankaDiSetup(options);
	const prefix = `${lankaDiContract.alias}/`;

	return {
		name: "lanka:di",

		buildStart() {
			const created = setup.verify();
			if (created.length > 0) this.warn(lankaDiScaffoldNotice(created));
		},

		resolveId(source) {
			if (!source.startsWith(prefix)) return null;

			// The extension is added here because the barrels are TypeScript and a
			// bare specifier resolves to nothing: rollup asks its plugins first and
			// only then the file system, which would look for a file with no suffix.
			return `${setup.dir}/${source.slice(prefix.length)}.ts`;
		},
	};
};
