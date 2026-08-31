import { lankaDiScaffoldNotice } from "../lanka-di-scaffold-notice/lankaDiScaffoldNotice";
import { lankaDiSetup } from "../lanka-di-setup/lankaDiSetup";
import type { ILankaDiPluginOptions } from "../_interfaces/ILankaDiPluginOptions";

/** What Next.js takes under `turbopack` in `next.config.js`. */
export interface ILankaTurbopackConfig {
	readonly resolveAlias: Readonly<Record<string, string>>;
}

/**
 * Turbopack's half of `next.config.js`, and the verification, at config time.
 *
 * ## Why this is a config helper and not a plugin
 *
 * Turbopack has no plugin API. What it has is `turbopack.resolveAlias` in
 * `next.config.js`, which is an ordinary JavaScript file evaluated before a build
 * starts — so this returns the alias to spread there, and does the verification
 * on the way, while there is still a config being read rather than a build to
 * fail.
 *
 * That is earlier than the other adapters check, not later: a problem is reported
 * before Next.js has done anything at all.
 *
 * ```js
 * const { lankaDiTurbopack } = require("@lankajs/tool-di/turbopack");
 *
 * module.exports = {
 *   turbopack: { ...lankaDiTurbopack({ scaffold: !process.env.CI }) },
 * };
 * ```
 *
 * Webpack builds of the same application keep using the webpack plugin; the two
 * describe the same contract and can sit in one config file.
 */
export const lankaDiTurbopack = (options: ILankaDiPluginOptions = {}): ILankaTurbopackConfig => {
	const setup = lankaDiSetup(options);
	const created = setup.verify();

	if (created.length > 0) {
		// A config file has no logger and no warning channel: `console` is what
		// Next.js itself uses while reading one, and staying silent would hide a
		// file the consumer must commit.
		console.warn(lankaDiScaffoldNotice(created));
	}

	return { resolveAlias: setup.alias };
};
