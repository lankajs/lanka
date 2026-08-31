import { RuleTester } from "eslint";
import { describe, it } from "vitest";
import { lankaDiBarrelsAreFrameworkOnly } from "./lankaDiBarrelsAreFrameworkOnly";

/**
 * The failing fixture matters more than the passing one: a rule without one is a
 * glob that matches nothing, and it reports success.
 *
 * Fixtures are shaped like a CONSUMER — the rule inspects an application tree.
 */
RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
	languageOptions: { ecmaVersion: 2022, sourceType: "module" },
});

ruleTester.run("di-barrels-are-framework-only", lankaDiBarrelsAreFrameworkOnly, {
	valid: [
		{
			name: "the application imports its own scenarios directly",
			filename: "/app/src/ViewModels/GapViewModel/GapViewModel.ts",
			code: `import { gapUpdated } from "@Scenarios/gapUpdated";`,
		},
	],
	invalid: [
		{
			name: "the application reads its own barrels — a second path to scenarios, invisible to the framework",
			filename: "/app/src/ViewModels/GapViewModel/GapViewModel.ts",
			code: `import { Scenarios } from "@lanka_di/Scenarios";`,
			errors: [{ messageId: "forbidden" }],
		},
	],
});
