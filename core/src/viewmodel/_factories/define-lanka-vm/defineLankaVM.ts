import { lankaVMRecipes } from "../../_internal/lanka-vm-recipes/lankaVMRecipes";
import type { ILankaReadableVM } from "../../_interfaces/ILankaReadableVM";

/**
 * The brand that makes a definition impossible to write by hand.
 *
 * Not exported, and that is the whole mechanism. A structural interface with
 * `name` and `build` on it would let a consumer author one, and the moment one
 * does, `ILankaVMDefinition` stops being a type the framework implements and
 * becomes a PORT — after which every member added to it is a compile error in
 * code nobody touched. Publishing an opaque type costs one line and keeps the
 * option space: a `dispose`, a `scope` field, even a call signature so that
 * `missionsVM()` could mean `resolveLankaVM(missionsVM)`, all stay additive.
 */
declare const LANKA_VM_DEFINITION: unique symbol;

/**
 * A ViewModel that has not been built yet.
 *
 * Hold it, pass it, type against it. There is nothing on it to call, because
 * calling it is `resolveLankaVM`'s job and a definition built by hand would be
 * an instance outside every scope's map.
 */
export interface ILankaVMDefinition<TViewModel extends ILankaReadableVM<object>> {
	readonly [LANKA_VM_DEFINITION]: TViewModel;
}

/**
 * Declares a ViewModel WITHOUT building it.
 *
 * ## When NOT to use this
 *
 * A browser-only application needs none of it. One module is one instance per
 * TAB there, so a module-level `createLankaVM` is still the shape, and wrapping
 * the nine factories in this one buys nothing but a lookup per read. Reach for
 * it when the same ViewModel has to exist on a SERVER, where one module is one
 * instance per PROCESS — shared by every user connected to it, so the first
 * request to write a draft into it serves that draft to the next stranger.
 *
 * ```ts
 * export const missionsVM = defineLankaVM({
 * 	name: "MissionsVM",
 * 	build: () => createLankaVM({ … }),
 * });
 * ```
 *
 * ## What it is not
 *
 * Not a tenth way to write a ViewModel. `build` returns whatever the nine
 * existing factories return and nothing here reaches inside it — a definition
 * adds a lifetime and takes nothing away.
 *
 * Not lazy in the sense `createLazyLankaVM` is. That one defers the STORE until
 * first read and still has one per module; this defers WHICH INSTANCE, and the
 * two compose.
 */
export const defineLankaVM = <TViewModel extends ILankaReadableVM<object>>(config: {
	name: string;
	build: () => TViewModel;
}): ILankaVMDefinition<TViewModel> => {
	const definition = Object.freeze({});

	lankaVMRecipes.recipes.set(definition, config);

	return definition as ILankaVMDefinition<TViewModel>;
};
