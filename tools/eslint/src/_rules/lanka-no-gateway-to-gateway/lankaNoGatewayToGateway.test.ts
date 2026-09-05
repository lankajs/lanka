import { RuleTester } from "eslint";
import tseslint from "typescript-eslint";
import { describe, it } from "vitest";
import { lankaNoGatewayToGateway } from "./lankaNoGatewayToGateway";

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
const tsRuleTester = new RuleTester({
	languageOptions: { parser: tseslint.parser, ecmaVersion: 2022, sourceType: "module" },
});

ruleTester.run("no-gateway-to-gateway", lankaNoGatewayToGateway, {
	valid: [
		{
			name: "a ViewModel composing two gateways is where a chain belongs",
			filename: "/app/src/ViewModels/ThingViewModel/ThingViewModel.ts",
			code: `import { thingsGateway } from "@Gateways/ThingsGateway";`,
		},
		{
			name: "a gateway sharing the layer BELOW it",
			filename: "/app/src/Gateways/ThingsGateway/ThingsGateway.ts",
			code: `import { ALankaGateway } from "lanka/gateway";`,
		},
		{
			name: "a gateway reaching its own neighbours",
			filename: "/app/src/Gateways/ThingsGateway/ThingsGateway.ts",
			code: `import { ThingSchema } from "./Validation/ThingSchema";`,
		},
		{
			name: "one gateway's schema embedding another's — a shape shared, not a request made",
			filename: "/app/src/Gateways/MeetingsGateway/Validation/MeetingSchemas.ts",
			code: `import { ThingSummarySchema } from "@Gateways/ThingsGateway/Validation/ThingSchemas";`,
			options: [{ declarationPattern: "/Validation/" }],
		},
	],
	invalid: [
		{
			name: "one gateway calling another",
			filename: "/app/src/Gateways/ThingsGateway/ThingsGateway.ts",
			code: `import { userGateway } from "@Gateways/UserGateway";`,
			errors: [{ messageId: "chained" }],
		},
		{
			name: "the tree is configuration, not a constant",
			filename: "/app/src/api/ThingApi.ts",
			code: `import { userApi } from "@Api/UserApi";`,
			options: [{ gatewayPattern: "^@Api/", gatewayDirs: ["api"] }],
			errors: [{ messageId: "chained" }],
		},
		{
			name: "without the option, a schema path is just another gateway path",
			filename: "/app/src/Gateways/MeetingsGateway/Validation/MeetingSchemas.ts",
			code: `import { ThingSummarySchema } from "@Gateways/ThingsGateway/Validation/ThingSchemas";`,
			errors: [{ messageId: "chained" }],
		},
	],
});

tsRuleTester.run("no-gateway-to-gateway (TypeScript)", lankaNoGatewayToGateway, {
	valid: [
		{
			name: "a type-only import makes no request",
			filename: "/app/src/Gateways/ThingsGateway/ThingsGateway.ts",
			code: `import type { TUser } from "@Gateways/UserGateway/Types/TUser";`,
		},
	],
	invalid: [
		{
			name: "a value import beside a type one is still a chain",
			filename: "/app/src/Gateways/ThingsGateway/ThingsGateway.ts",
			code: `import { type TUser, userGateway } from "@Gateways/UserGateway";`,
			errors: [{ messageId: "chained" }],
		},
	],
});
