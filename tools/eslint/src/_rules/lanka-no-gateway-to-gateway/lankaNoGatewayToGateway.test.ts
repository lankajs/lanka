import { RuleTester } from "eslint";
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

ruleTester.run("no-gateway-to-gateway", lankaNoGatewayToGateway, {
	valid: [
		{
			name: "a ViewModel composing two gateways is where a chain belongs",
			filename: "/app/src/ViewModels/GapViewModel/GapViewModel.ts",
			code: `import { gapGateway } from "@Gateways/GapGateway";`,
		},
		{
			name: "a gateway sharing the layer BELOW it",
			filename: "/app/src/Gateways/GapGateway/GapGateway.ts",
			code: `import { ALankaGateway } from "lanka/gateway";`,
		},
		{
			name: "a gateway reaching its own neighbours",
			filename: "/app/src/Gateways/GapGateway/GapGateway.ts",
			code: `import { GapSchema } from "./Validation/GapSchema";`,
		},
	],
	invalid: [
		{
			name: "one gateway calling another",
			filename: "/app/src/Gateways/GapGateway/GapGateway.ts",
			code: `import { userGateway } from "@Gateways/UserGateway";`,
			errors: [{ messageId: "chained" }],
		},
		{
			name: "the tree is configuration, not a constant",
			filename: "/app/src/api/GapApi.ts",
			code: `import { userApi } from "@Api/UserApi";`,
			options: [{ gatewayPattern: "^@Api/", gatewayDirs: ["api"] }],
			errors: [{ messageId: "chained" }],
		},
	],
});
