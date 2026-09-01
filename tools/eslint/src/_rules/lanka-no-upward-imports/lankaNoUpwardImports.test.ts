import { RuleTester } from "eslint";
import { describe, it } from "vitest";
import { lankaNoUpwardImports } from "./lankaNoUpwardImports";

/**
 * The failing fixtures matter more than the passing ones.
 *
 * A rule without a failing fixture is a glob that matches nothing: it does not
 * fail, it silently checks nobody.
 *
 * Fixtures are shaped like a CONSUMER, not like the framework: the rule inspects
 * an application tree, so a fixture built from framework files would prove the
 * wrong thing.
 */
RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
	languageOptions: { ecmaVersion: 2022, sourceType: "module" },
});

ruleTester.run("no-upward-imports", lankaNoUpwardImports, {
	valid: [
		{
			name: "a module imports a module — the upper layer knows itself",
			filename: "/app/src/Modules/Thing/ThingCard.tsx",
			code: `import { Button } from "@Modules/_Shared/Button";`,
		},
		{
			name: "the application core imports the core",
			filename: "/app/src/Core/Helpers/date.ts",
			code: `import { pad } from "@Core/Helpers/pad";`,
		},
		{
			name: "a relative import downward",
			filename: "/app/src/Core/Helpers/date.ts",
			code: `import { pad } from "./pad";`,
		},
	],
	invalid: [
		{
			name: "the core reaches into modules — one such import makes everyone depend on one module",
			filename: "/app/src/Core/Helpers/date.ts",
			code: `import { ThingCard } from "@Modules/Thing/ThingCard";`,
			errors: [{ messageId: "upward" }],
		},
		{
			name: "a ViewModel reaches into App",
			filename: "/app/src/ViewModels/ThingViewModel/ThingViewModel.ts",
			code: `import { router } from "@App/router";`,
			errors: [{ messageId: "upward" }],
		},
		{
			name: "a relative path upward is caught the same way",
			filename: "/app/src/Core/Helpers/date.ts",
			code: `import { ThingCard } from "../../Modules/Thing/ThingCard";`,
			errors: [{ messageId: "upward" }],
		},
	],
});
