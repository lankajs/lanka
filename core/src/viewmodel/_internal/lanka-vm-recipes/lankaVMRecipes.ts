import type { ILankaReadableVM } from "../../_interfaces/ILankaReadableVM";

/** What a definition actually holds, kept where a consumer cannot reach it. */
export interface ILankaVMRecipe {
	readonly name: string;
	readonly build: () => ILankaReadableVM<object>;
}

/**
 * What `defineLankaVM` writes and `resolveLankaVM` reads.
 *
 * One object rather than two exported maps, because a file here holds one
 * runtime identity — and because the two halves are one mechanism: a recipe
 * nobody can resolve and an instance map keyed by nothing are each meaningless
 * alone.
 *
 * ## Weak at both ends, and both ends matter
 *
 * `recipes` is weak so a definition dropped by its module takes its recipe with
 * it. `instances` is weak in the SCOPE so a finished request's ViewModels go
 * when its scope does, and weak in the DEFINITION because the published type
 * invites `defineLankaVM({...})` written inline in a component or a loop — in a
 * browser the scope key is the framework instance and lives as long as the tab,
 * so a strong inner map would hold every inline definition and its ViewModel
 * for the life of the page.
 */
export const lankaVMRecipes = {
	recipes: new WeakMap<object, ILankaVMRecipe>(),
	instances: new WeakMap<object, WeakMap<object, ILankaReadableVM<object>>>(),

	/** The instances belonging to one scope, created on first use. */
	forScope(scope: object): WeakMap<object, ILankaReadableVM<object>> {
		const existing = this.instances.get(scope);

		if (existing) return existing;

		const created = new WeakMap<object, ILankaReadableVM<object>>();

		this.instances.set(scope, created);

		return created;
	},
};
