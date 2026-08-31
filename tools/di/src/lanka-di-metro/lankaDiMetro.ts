import { lankaDiContract } from "../lanka-di-contract/lankaDiContract";
import { lankaDiScaffoldNotice } from "../lanka-di-scaffold-notice/lankaDiScaffoldNotice";
import { lankaDiSetup } from "../lanka-di-setup/lankaDiSetup";
import type { ILankaDiPluginOptions } from "../_interfaces/ILankaDiPluginOptions";

/**
 * The part of a Metro config this adapter reads and writes.
 *
 * Described structurally and imported from nowhere, for the reason the webpack
 * plugin gives: a web consumer installs this package and must not be asked for
 * `metro-config`, which only a React Native project has.
 */
export interface ILankaMetroConfig {
	readonly projectRoot?: string;
	readonly resolver?: {
		readonly extraNodeModules?: Readonly<Record<string, string>>;
	};
}

/** What the adapter has put on the config by the time it hands it back. */
export interface ILankaMetroResolver {
	readonly extraNodeModules: Readonly<Record<string, string>>;
}

/**
 * The caller's config, plus what this adapter guarantees on it.
 *
 * Spelled out rather than left as `TConfig`: a caller who reads
 * `config.resolver.extraNodeModules` back — a test, or a wrapper that composes
 * after this one — would otherwise be told the field they just asked for does
 * not exist, because their literal type never mentioned a resolver.
 */
export type TLankaMetroConfig<TConfig extends ILankaMetroConfig> = TConfig & {
	readonly resolver: NonNullable<TConfig["resolver"]> & ILankaMetroResolver;
};

/**
 * Metro's half of `metro.config.js`, and the verification, at config time.
 *
 * ## Why this takes the config instead of returning a plugin
 *
 * Metro has no plugin array. What it has is a config object that every tool in
 * the React Native ecosystem takes and returns — `withNativeWind(config)`,
 * `wrapWithReanimatedMetroConfig(config)` — so this is a function of the config
 * too, and composes with them by being the same shape.
 *
 * ```js
 * const { getDefaultConfig } = require("expo/metro-config");
 * const { lankaDiMetro } = require("@lankajs/tool-di/metro");
 *
 * module.exports = lankaDiMetro(getDefaultConfig(__dirname), { scaffold: !process.env.CI });
 * ```
 *
 * It MERGES rather than replaces: `extraNodeModules` carries whatever Expo and
 * the other wrappers put there, and a spread that dropped them would break
 * resolution for packages this one has never heard of.
 *
 * The generic is what makes it composable — the caller's own config type comes
 * back out, so `getDefaultConfig`'s return value does not decay into this
 * interface halfway down the file.
 *
 * ## What is NOT solved by the alias
 *
 * The alias makes the barrels resolve. It says nothing about whether what they
 * export runs on a device: `@lankajs/storage`, `@lankajs/browser`, `@lankajs/blob-cache`
 * and `@lankajs/plugin-devtools` are browser packages and stay in a web build.
 * Core, the gateways and the ViewModels have no DOM in them and do run.
 */
export const lankaDiMetro = <TConfig extends ILankaMetroConfig>(
	config: TConfig,
	options: ILankaDiPluginOptions = {},
): TLankaMetroConfig<TConfig> => {
	// Metro already knows the project root, the way vite knows its resolved root
	// and webpack its `context`. Asking the consumer to say it a second time is
	// asking for the one place the two answers can disagree.
	const setup = lankaDiSetup({ ...options, root: options.root ?? config.projectRoot });
	const created = setup.verify();

	if (created.length > 0) {
		// A config file has no logger: `console` is what Metro itself uses while
		// one is being read, and silence would hide a file the consumer must commit.
		console.warn(lankaDiScaffoldNotice(created));
	}

	return {
		...config,
		resolver: {
			...config.resolver,
			extraNodeModules: {
				...config.resolver?.extraNodeModules,
				[lankaDiContract.alias]: setup.dir,
			},
		},
	};
};
