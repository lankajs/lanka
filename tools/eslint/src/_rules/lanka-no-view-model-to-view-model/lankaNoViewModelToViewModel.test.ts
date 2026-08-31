import { RuleTester } from "eslint";
import { describe, it } from "vitest";
import { lankaNoViewModelToViewModel } from "./lankaNoViewModelToViewModel";

/**
 * The failing fixtures matter more than the passing ones: a rule without one is
 * a glob that matches nothing, and it reports success.
 */
RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
	languageOptions: { ecmaVersion: 2022, sourceType: "module" },
});

ruleTester.run("no-viewmodel-to-viewmodel", lankaNoViewModelToViewModel, {
	valid: [
		{
			name: "a screen reads a ViewModel — that is what they are for",
			filename: "/app/src/Modules/Gap/GapCard.tsx",
			code: `import { useGapViewModel } from "@ViewModels/GapViewModel";`,
		},
		{
			name: "a ViewModel carrying a fact through a scenario",
			filename: "/app/src/ViewModels/GapViewModel/GapViewModel.ts",
			code: `import { gapCompleted } from "@Scenarios/GapCompleted";`,
		},
		{
			name: "a ViewModel reaching its own service",
			filename: "/app/src/ViewModels/GapViewModel/GapViewModel.ts",
			code: `import { gapSortService } from "./Services/GapSortService";`,
		},
	],
	invalid: [
		{
			name: "one ViewModel importing another",
			filename: "/app/src/ViewModels/GapViewModel/GapViewModel.ts",
			code: `import { useUserViewModel } from "@ViewModels/UserViewModel";`,
			errors: [{ messageId: "coupled" }],
		},
		{
			name: "the tree is configuration, not a constant",
			filename: "/app/src/stores/GapStore.ts",
			code: `import { userStore } from "@Stores/UserStore";`,
			options: [{ viewModelPattern: "^@Stores/", viewModelDirs: ["stores"] }],
			errors: [{ messageId: "coupled" }],
		},
	],
});
