import { Linter } from "eslint";
import { lankaBoundaries } from "../../src/index";
import type { IPlaygroundFile } from "../_interfaces/IPlaygroundFile";

/**
 * Lints with the published config plus the one rule a project must configure.
 *
 * `layer-style` ships switched on and silent: the framework has no opinion about
 * which style a layer is written in, so it reports nothing until a project makes
 * a choice. That makes it the only published rule whose consumer path cannot be
 * exercised by `lintWithPublishedConfig` — hence a second door, taking exactly
 * what a consumer would write in their own flat config.
 */
export const lintWithPinnedStyles = (
	file: IPlaygroundFile,
	styles: Record<string, unknown>,
): Linter.LintMessage[] => {
	const linter = new Linter();

	return linter.verify(
		file.code,
		[
			{
				files: ["**/*.{ts,tsx}"],
				languageOptions: { ecmaVersion: 2022, sourceType: "module" },
				...lankaBoundaries,
				rules: { ...lankaBoundaries.rules, "lanka/layer-style": ["error", styles] },
			},
		],
		file.filename,
	);
};
