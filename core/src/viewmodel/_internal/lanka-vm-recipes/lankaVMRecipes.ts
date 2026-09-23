import type { ILankaReadableVM } from "../../_interfaces/ILankaReadableVM";
import type { ILankaScenarioVM } from "../../../scenario/_interfaces/ILankaScenarioVM";

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
 *
 * ## `owned` is the one strong set, and it is drained
 *
 * A scope handed to `resolveLankaVM` must be able to take its ViewModels OFF the
 * bus when it closes, and a WeakMap cannot be walked. So what a scope built is
 * also kept in a Set it can read — strong, because the scope must find these
 * even when nothing else holds them — and `release` hands the set over and
 * forgets it, so a closed scope keeps nothing alive.
 */
export const lankaVMRecipes = {
	recipes: new WeakMap<object, ILankaVMRecipe>(),
	instances: new WeakMap<object, WeakMap<object, ILankaReadableVM<object>>>(),
	owned: new WeakMap<object, Set<ILankaScenarioVM>>(),

	/** The instances belonging to one scope, created on first use. */
	forScope(scope: object): WeakMap<object, ILankaReadableVM<object>> {
		const existing = this.instances.get(scope);

		if (existing) return existing;

		const created = new WeakMap<object, ILankaReadableVM<object>>();

		this.instances.set(scope, created);

		return created;
	},
	/** Records that `scope` built a ViewModel that registered for scenarios. */
	own(scope: object, viewModel: ILankaScenarioVM): void {
		const set = this.owned.get(scope) ?? new Set<ILankaScenarioVM>();
		set.add(viewModel);
		this.owned.set(scope, set);
	},
	/** Everything `scope` owns, handed over once; the scope then holds nothing. */
	release(scope: object): ILankaScenarioVM[] {
		const set = this.owned.get(scope);
		this.owned.delete(scope);
		this.instances.delete(scope);
		return set ? [...set] : [];
	},
};
