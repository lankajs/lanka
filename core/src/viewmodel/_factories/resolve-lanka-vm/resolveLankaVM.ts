import {
	getActiveLankaScope,
	hasLankaScopeResolver,
	requireActiveRuntime,
} from "../../../_internal/active-runtime/activeRuntime";
import { lankaScenarioBootstrap } from "../../../scenario/lanka-scenario-bootstrap/LankaScenarioBootstrap";
import { lankaVMRecipes } from "../../_internal/lanka-vm-recipes/lankaVMRecipes";
import type { ILankaVMDefinition } from "../define-lanka-vm/defineLankaVM";
import type { ILankaReadableVM } from "../../_interfaces/ILankaReadableVM";

/**
 * The instance of a definition that belongs to the CURRENT scope.
 *
 * Called twice in one scope it answers the same instance; called in two scopes
 * it answers two, and neither can see the other's state. In a browser there is
 * one scope for the life of the tab, so this is the module-level ViewModel a
 * consumer already knows — written once and correct on a server as well.
 *
 * ## It throws outside a scope, and that is the feature
 *
 * On a server the answer comes from the SCOPE seam rather than from the active
 * runtime, and the difference is not academic. `runInLankaServerScope` creates
 * its instance inside the scope and `createLanka` activates every instance it
 * builds, so during a request the process pointer and the scope's runtime are
 * the same object — keying on the runtime would make "inside a request" and
 * "after one ended" indistinguishable, and a call made after would be handed the
 * last stranger's ViewModel.
 *
 * So: a scope resolver installed and answering `null` means this ran outside
 * every request, and that fails loudly. No fallback, for the same reason
 * `requireActiveRuntime` has none — a wrong answer here is one user's data in
 * another user's page, and it would surface three layers from the call.
 *
 * ## Why the build is wrapped
 *
 * `ALankaVM.build()` declares a ViewModel that has scenario handlers into a
 * PROCESS-wide list, so that every instance ever created adopts it. That is
 * right for a module-level ViewModel and catastrophic for a scoped one: the list
 * would grow per request forever, and request N+1 would adopt request N's
 * ViewModel and run N's handlers against N's gateways. `buildScoped` is the seam
 * that keeps a scoped declaration out of it.
 */
export const resolveLankaVM = <TViewModel extends ILankaReadableVM<object>>(
	definition: ILankaVMDefinition<TViewModel>,
): TViewModel => {
	const recipe = lankaVMRecipes.recipes.get(definition);

	if (!recipe) {
		throw new Error(
			"resolveLankaVM was given something defineLankaVM did not make. A definition " +
				"is opaque on purpose: build it with defineLankaVM rather than by hand.",
		);
	}

	const runtime = requireActiveRuntime();
	const scope = getActiveLankaScope();

	if (hasLankaScopeResolver() && !scope) {
		throw new Error(
			`resolveLankaVM("${recipe.name}") ran outside every scope. A scope resolver is ` +
				"installed, which on a server means this code ran outside a request — and a " +
				"ViewModel resolved there would be the previous request's. Do this work inside " +
				"the scope, or start one.",
		);
	}

	// The runtime when nothing knows about scopes: a browser tab is one scope for
	// its whole life, and the instance is what identifies it.
	const instances = lankaVMRecipes.forScope(scope ?? runtime);
	const held = instances.get(definition);

	if (held) return held as TViewModel;

	const built = lankaScenarioBootstrap.buildScoped(() => recipe.build());

	instances.set(definition, built);

	return built as TViewModel;
};
