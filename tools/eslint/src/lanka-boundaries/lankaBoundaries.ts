import type { Linter } from "eslint";
import { lankaEslintPlugin } from "../lanka-eslint-plugin/lankaEslintPlugin";

/**
 * A ready-made config for a consuming application.
 *
 * Paths in the rules are SETTINGS, and the defaults describe the tree these
 * applications use (`Modules`, `App`, `ViewModels`, `@Gateways/…`). A different
 * tree configures the rules; it does not switch them off.
 */
export const lankaBoundaries: Linter.Config = Object.freeze<Linter.Config>({
	plugins: { lanka: lankaEslintPlugin },
	rules: {
		"lanka/no-upward-imports": "error",
		"lanka/gateways-only-in-viewmodels": "error",
		"lanka/di-barrels-are-framework-only": "error",
		"lanka/no-gateway-to-gateway": "error",
		"lanka/no-viewmodel-to-viewmodel": "error",
		// On, and silent until a project pins a style — see the rule.
		"lanka/layer-style": "error",
	},
});
