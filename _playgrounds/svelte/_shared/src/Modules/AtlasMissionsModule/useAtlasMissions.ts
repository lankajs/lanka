import { useLankaVM } from "@lankajs/svelte";
import type { TLankaVMView } from "@lankajs/svelte";
import type { ILankaReadableVM } from "lanka/viewmodel";
import type { IAtlasMissionsActions, IAtlasMissionsState } from "@lanka-playgrounds/_shared";

/**
 * The missions ViewModel, as every Svelte screen in this ecosystem receives it.
 *
 * `ILankaReadableVM` and not the concrete builder's return: a screen reads and
 * acts, and nothing above it may call `setState`.
 */
export type TAtlasMissionsVM = ILankaReadableVM<IAtlasMissionsState & IAtlasMissionsActions>;

/**
 * Read the missions ViewModel, and nothing more.
 *
 * A named function rather than `useLankaVM(vm)` at each call site because the
 * ecosystem's read path is a decision, and a decision with three copies has no
 * place to be changed.
 *
 * It answers an object of GETTERS, which is Svelte's own shape: a read registers
 * with the reactivity graph and with the access tracker in one access, so
 * `missions.rows()` in markup re-runs exactly when `rows` moves. `toLankaSvelteVM`
 * is the other spelling, for a codebase that reads with `$`; the screens here use
 * the portable one so that reading them beside React's and Vue's shows only each
 * framework's own syntax.
 */
export const useAtlasMissions = (
	missionsVM: TAtlasMissionsVM,
): TLankaVMView<IAtlasMissionsState & IAtlasMissionsActions> => useLankaVM(missionsVM);
