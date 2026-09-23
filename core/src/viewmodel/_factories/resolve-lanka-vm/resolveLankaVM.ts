import {
	getActiveLankaScope,
	hasLankaScopeResolver,
	requireActiveRuntime,
} from "../../../_internal/active-runtime/activeRuntime";
import { lankaScenarioBootstrap } from "../../../scenario/lanka-scenario-bootstrap/LankaScenarioBootstrap";
import { lankaVMRecipes } from "../../_internal/lanka-vm-recipes/lankaVMRecipes";
import type { ILankaVMDefinition } from "../define-lanka-vm/defineLankaVM";
import type { ILankaReadableVM } from "../../_interfaces/ILankaReadableVM";
import type { ILankaScope } from "../../../locator/_factories/create-lanka-scope/createLankaScope";
import type { ILankaScenarioVM } from "../../../scenario/_interfaces/ILankaScenarioVM";
import type { ILankaVMRecipe } from "../../_internal/lanka-vm-recipes/lankaVMRecipes";

/** A closed scope hands nothing out — at resolve time, or at a lazy first read. */
const closedScope = (name: string): Error =>
	new Error(
		`The scope is closed: "${name}" can no longer be resolved in it. ` +
			`This is usually a scope reference that outlived the screen that created it.`,
	);

/**
 * Where the instance should live, when not in the current scope.
 *
 * `scope` is a lifetime shorter than the page's: a module that mounts and
 * later leaves, a modal, a route. The ViewModel resolved with it is that
 * scope's own — one per definition in it, a different one from the page's —
 * and `scope.dispose()` takes it off the bus and out of the registry.
 */
export interface ILankaResolveVMOptions {
	scope?: ILankaScope;
}

/** The recipe a definition holds, or a refusal: a definition is opaque on purpose. */
const recipeOf = (definition: object): ILankaVMRecipe => {
	const recipe = lankaVMRecipes.recipes.get(definition);

	if (!recipe) {
		throw new Error(
			"resolveLankaVM was given something defineLankaVM did not make. A definition " +
				"is opaque on purpose: build it with defineLankaVM rather than by hand.",
		);
	}

	return recipe;
};

/**
 * What the instance is keyed on: the scope handed in, else the current one, else
 * the runtime — a browser tab is one scope for its whole life, and the instance
 * is what identifies it. A closed scope, or no scope where a resolver says there
 * must be one, is refused.
 */
const scopeKeyOf = (name: string, own: ILankaScope | undefined): object => {
	const runtime = requireActiveRuntime();

	if (own?.isDisposed()) throw closedScope(name);

	const scope = own ?? getActiveLankaScope();

	if (!own && hasLankaScopeResolver() && !scope) {
		throw new Error(
			`resolveLankaVM("${name}") ran outside every scope. A scope resolver is ` +
				"installed, which on a server means this code ran outside a request — and a " +
				"ViewModel resolved there would be the previous request's. Do this work inside " +
				"the scope, or start one.",
		);
	}

	return scope ?? runtime;
};

/**
 * Tells an explicit scope what it built, so closing it can take it off the bus.
 *
 * A LAZY ViewModel registers on its first read, which may come after the scope
 * closed; building it then would subscribe a ViewModel whose scope is gone.
 */
const reportTo =
	(own: ILankaScope, name: string) =>
	(viewModel: ILankaScenarioVM): void => {
		if (own.isDisposed()) throw closedScope(name);
		lankaVMRecipes.own(own, viewModel);
	};

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
 *
 * ## An explicit scope
 *
 * A scope handed in `options` is the key instead, and the same seam keeps its
 * ViewModels out of the process-wide list. The scope is told what it built, so
 * that closing it can take them off the bus — which is the whole reason a
 * module would hand one in. A closed scope is refused like `scope.resolve`
 * refuses: an object handed out of it would outlive what it belongs to.
 */
export const resolveLankaVM = <TViewModel extends ILankaReadableVM<object>>(
	definition: ILankaVMDefinition<TViewModel>,
	options?: ILankaResolveVMOptions,
): TViewModel => {
	const recipe = recipeOf(definition);
	const own = options?.scope;
	const instances = lankaVMRecipes.forScope(scopeKeyOf(recipe.name, own));
	const held = instances.get(definition);

	if (held) return held as TViewModel;

	const built = lankaScenarioBootstrap.buildScoped(
		() => recipe.build(),
		own ? reportTo(own, recipe.name) : undefined,
	);

	instances.set(definition, built);

	return built as TViewModel;
};
