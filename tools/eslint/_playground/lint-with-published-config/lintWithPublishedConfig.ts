import { Linter } from "eslint";
import { lankaBoundaries } from "../../src/index";
import type { IPlaygroundFile } from "../_interfaces/IPlaygroundFile";

/**
 * Lints a file with the published config, exactly as a consumer's ESLint would.
 *
 * `lankaBoundaries` is spread into a config that also states the language
 * options, which is what a real flat config does — and what makes this exercise
 * the plugin object, the rule registrations and the ready-made config AGREEING,
 * three things a rule's own tests never see together.
 */
export const lintWithPublishedConfig = (file: IPlaygroundFile): Linter.LintMessage[] => {
	const linter = new Linter();

	return linter.verify(
		file.code,
		[
			{
				files: ["**/*.{ts,tsx}"],
				languageOptions: { ecmaVersion: 2022, sourceType: "module" },
				...lankaBoundaries,
			},
		],
		file.filename,
	);
};
