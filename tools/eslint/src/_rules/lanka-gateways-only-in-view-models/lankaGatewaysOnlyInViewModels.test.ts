import { RuleTester } from "eslint";
import tseslint from "typescript-eslint";
import { describe, it } from "vitest";
import { lankaGatewaysOnlyInViewModels } from "./lankaGatewaysOnlyInViewModels";

/**
 * The failing fixtures matter more than the passing ones: a rule without one is
 * a glob that matches nothing, and it reports success.
 *
 * Fixtures are shaped like a CONSUMER — the rule inspects an application tree.
 * The type-only cases run under the TypeScript parser, because `import type` is
 * its syntax; everything else stays on espree, which is what a JavaScript
 * consumer has.
 */
RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
	languageOptions: { ecmaVersion: 2022, sourceType: "module" },
});
const tsRuleTester = new RuleTester({
	languageOptions: { parser: tseslint.parser, ecmaVersion: 2022, sourceType: "module" },
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
		{
			name: "a gateway's declarations are not a call — when the consumer names them",
			filename: "/app/src/Modules/Thing/ThingCard.tsx",
			code: `import { ThingNotFoundError } from "@Gateways/ThingsGateway/Errors/ThingErrors";`,
			options: [{ declarationPattern: "/(Validation|Errors)/" }],
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
		{
			name: "without the option, a declaration folder is just another gateway path",
			filename: "/app/src/Modules/Thing/ThingCard.tsx",
			code: `import { ThingNotFoundError } from "@Gateways/ThingsGateway/Errors/ThingErrors";`,
			errors: [{ messageId: "outside" }],
		},
	],
});

tsRuleTester.run("gateways-only-in-viewmodels (TypeScript)", lankaGatewaysOnlyInViewModels, {
	valid: [
		{
			name: "a type-only import is erased before anything runs",
			filename: "/app/src/Modules/Thing/ThingCard.tsx",
			code: `import type { TThing } from "@Gateways/ThingsGateway/Types/TThing";`,
		},
		{
			name: "every specifier marked type is the same thing",
			filename: "/app/src/Core/Helpers/thingLabel.ts",
			code: `import { type TThing, type TThingId } from "@Gateways/ThingsGateway/Types";`,
		},
	],
	invalid: [
		{
			name: "one value specifier among type ones is still a call",
			filename: "/app/src/Modules/Thing/ThingCard.tsx",
			code: `import { type TThing, thingsGateway } from "@Gateways/ThingsGateway";`,
			errors: [{ messageId: "outside" }],
		},
	],
});
