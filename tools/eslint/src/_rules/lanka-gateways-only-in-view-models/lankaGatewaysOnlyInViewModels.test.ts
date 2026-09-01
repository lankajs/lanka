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
			filename: "/app/src/ViewModels/ThingViewModel/ThingViewModel.ts",
			code: `import { thingsGateway } from "@Gateways/ThingsGateway";`,
		},
		{
			name: "a component that does not touch a gateway",
			filename: "/app/src/Modules/Thing/ThingCard.tsx",
			code: `import { useGapViewModel } from "@ViewModels/ThingViewModel";`,
		},
	],
	invalid: [
		{
			name: "a component reached a gateway — the screen lost loading, failure and cancellation",
			filename: "/app/src/Modules/Thing/ThingCard.tsx",
			code: `import { thingsGateway } from "@Gateways/ThingsGateway";`,
			errors: [{ messageId: "outside" }],
		},
		{
			name: "a helper has no right either",
			filename: "/app/src/Core/Helpers/loadGap.ts",
			code: `import { thingsGateway } from "@Gateways/ThingsGateway";`,
			errors: [{ messageId: "outside" }],
		},
	],
});
