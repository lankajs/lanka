import { useLankaVM } from "@lankajs/vue";
import type { ILankaVMRef } from "@lankajs/vue";
import type { ILankaReadableVM } from "lanka/viewmodel";
import type { IAtlasMissionsActions, IAtlasMissionsState } from "@lanka-playgrounds/_shared";

/**
 * The missions ViewModel, as every Vue screen in this ecosystem receives it.
 *
 * `ILankaReadableVM` and not the concrete builder's return: a screen reads and
 * acts, and nothing above it may call `setState`.
 */
export type TAtlasMissionsVM = ILankaReadableVM<IAtlasMissionsState & IAtlasMissionsActions>;

/**
 * Read the missions ViewModel, and nothing more.
 *
 * The plain read, for a screen whose state arrived some other way — hydrated
 * from the server, or already fetched by a sibling.
 *
 * A named composable rather than `useLankaVM(vm)` at each call site because the
 * ecosystem's read path is a decision, and a decision with three copies has no
 * place to be changed. What it delegates to is `@lankajs/vue`'s — the only
 * member of the bindings shelf a Vue host may use.
 *
 * It answers the binding's `ShallowRef`, so a caller writes `missions.value` in
 * a script and `missions` in a template. `defineLankaComposable` is the other
 * spelling, for a codebase that reads like Pinia; this one is the portable read
 * every binding on the shelf publishes, and the screens here use it so that
 * reading them beside React's shows only each framework's own syntax.
 */
export const useAtlasMissions = (
	missionsVM: TAtlasMissionsVM,
): ILankaVMRef<IAtlasMissionsState & IAtlasMissionsActions> => useLankaVM(missionsVM);
