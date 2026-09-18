import { useLankaVM } from "@lankajs/solid";
import type { TLankaVMAccessor } from "@lankajs/solid";
import type { ILankaReadableVM } from "lanka/viewmodel";
import type { IAtlasMissionsActions, IAtlasMissionsState } from "@lanka-playgrounds/_shared";

/**
 * The missions ViewModel, as every Solid screen in this ecosystem receives it.
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
 * It answers an `Accessor`, which is Solid's own shape: `missions().rows()` in
 * JSX subscribes the surrounding computation, and the signal only changes when a
 * key the reader looked at moves. `toLankaSolidVM` is the other spelling, for a
 * codebase that prefers a store-shaped object; the screens here use the portable
 * one so that reading them beside React's, Vue's and Svelte's shows only each
 * framework's own syntax.
 *
 * ## The name starts with `use` and nothing about it is a hook
 *
 * A Solid component runs ONCE. There is no render to be ordered against, so
 * there is no rule about calling this conditionally or in a loop — the prefix is
 * a convention shared across the shelf so a consumer moving a screen between
 * frameworks reads one guide, and the repository's lint config was narrowed to
 * React's own applications the day this package arrived.
 */
export const useAtlasMissions = (
	missionsVM: TAtlasMissionsVM,
): TLankaVMAccessor<IAtlasMissionsState & IAtlasMissionsActions> => useLankaVM(missionsVM);
