import type { Rule } from "eslint";
import { lankaNoUpwardImports } from "../_rules/lanka-no-upward-imports/lankaNoUpwardImports";
import { lankaGatewaysOnlyInViewModels } from "../_rules/lanka-gateways-only-in-view-models/lankaGatewaysOnlyInViewModels";
import { lankaDiBarrelsAreFrameworkOnly } from "../_rules/lanka-di-barrels-are-framework-only/lankaDiBarrelsAreFrameworkOnly";
import { lankaNoGatewayToGateway } from "../_rules/lanka-no-gateway-to-gateway/lankaNoGatewayToGateway";
import { lankaLayerStyle } from "../_rules/lanka-layer-style/lankaLayerStyle";
import { lankaNoViewModelToViewModel } from "../_rules/lanka-no-view-model-to-view-model/lankaNoViewModelToViewModel";

/** The plugin object an ESLint flat config registers under a namespace. */
export const lankaEslintPlugin = Object.freeze({
	meta: { name: "@lankajs/tool-eslint" },
	rules: {
		"no-upward-imports": lankaNoUpwardImports,
		"gateways-only-in-viewmodels": lankaGatewaysOnlyInViewModels,
		"di-barrels-are-framework-only": lankaDiBarrelsAreFrameworkOnly,
		"no-gateway-to-gateway": lankaNoGatewayToGateway,
		"no-viewmodel-to-viewmodel": lankaNoViewModelToViewModel,
		"layer-style": lankaLayerStyle,
	} satisfies Record<string, Rule.RuleModule>,
});
