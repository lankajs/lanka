import { RuleTester } from "eslint";
import { describe, it } from "vitest";
import { lankaGatewaysOnlyInViewModels } from "./lankaGatewaysOnlyInViewModels";

/**
 * The failing fixtures matter more than the passing ones: a rule without one is
 * a glob that matches nothing, and it reports success.
 *
 * Fixtures are shaped like a CONSUMER — the rule inspects an application tree.
 */
RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
	languageOptions: { ecmaVersion: 2022, sourceType: "module" },
});

ruleTester.run("gateways-only-in-viewmodels", lankaGatewaysOnlyInViewModels, {
	valid: [
		{
			name: "a ViewModel is the only legal place",
			filename: "/app/src/ViewModels/GapViewModel/GapViewModel.ts",
			code: `import { gapGateway } from "@Gateways/GapGateway";`,
		},
		{
			name: "a component that does not touch a gateway",
			filename: "/app/src/Modules/Gap/GapCard.tsx",
			code: `import { useGapViewModel } from "@ViewModels/GapViewModel";`,
		},
	],
	invalid: [
		{
			name: "a component reached a gateway — the screen lost loading, failure and cancellation",
			filename: "/app/src/Modules/Gap/GapCard.tsx",
			code: `import { gapGateway } from "@Gateways/GapGateway";`,
			errors: [{ messageId: "outside" }],
		},
		{
			name: "a helper has no right either",
			filename: "/app/src/Core/Helpers/loadGap.ts",
			code: `import { gapGateway } from "@Gateways/GapGateway";`,
			errors: [{ messageId: "outside" }],
		},
	],
});
