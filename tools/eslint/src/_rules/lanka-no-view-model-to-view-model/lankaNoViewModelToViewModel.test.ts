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
			filename: "/app/src/Modules/Thing/ThingCard.tsx",
			code: `import { useGapViewModel } from "@ViewModels/ThingViewModel";`,
		},
		{
			name: "a ViewModel carrying a fact through a scenario",
			filename: "/app/src/ViewModels/ThingViewModel/ThingViewModel.ts",
			code: `import { thingCompleted } from "@Scenarios/ThingCompleted";`,
		},
		{
			name: "a ViewModel reaching its own service",
			filename: "/app/src/ViewModels/ThingViewModel/ThingViewModel.ts",
			code: `import { thingSortService } from "./Services/ThingSortService";`,
		},
	],
	invalid: [
		{
			name: "one ViewModel importing another",
			filename: "/app/src/ViewModels/ThingViewModel/ThingViewModel.ts",
			code: `import { useUserViewModel } from "@ViewModels/UserViewModel";`,
			errors: [{ messageId: "coupled" }],
		},
		{
			name: "the tree is configuration, not a constant",
			filename: "/app/src/stores/ThingStore.ts",
			code: `import { userStore } from "@Stores/UserStore";`,
			options: [{ viewModelPattern: "^@Stores/", viewModelDirs: ["stores"] }],
			errors: [{ messageId: "coupled" }],
		},
	],
});
