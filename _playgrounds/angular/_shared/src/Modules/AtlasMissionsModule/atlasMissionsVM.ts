import { InjectionToken } from "@angular/core";
import type { TAtlasMissionsVM } from "./useAtlasMissions";

/**
 * How an Angular screen is GIVEN the missions ViewModel.
 *
 * Every other ecosystem here passes a ViewModel as a prop, because every other
 * framework has one way to hand a component something. Angular has two, and they
 * mean different things: an `input` is DATA that a parent owns and changes, and
 * a provider is a DEPENDENCY that exists for the lifetime of an injector.
 *
 * A ViewModel is the second. Its identity never changes for the life of a
 * screen, and it is the same instance several sibling components read — which is
 * exactly what an injector is for, and exactly what an input is not.
 *
 * ## The failure that made the choice obvious
 *
 * `input.required` cannot be read in a field initialiser: the value arrives
 * after construction, and Angular answers NG0950. But `useLankaVM` has to run in
 * an injection context, because its subscription is torn down by `DestroyRef` —
 * so a screen taking its ViewModel as a required input has nowhere left to read
 * it. `inject()` in a field initialiser is both at once, which is the shape
 * Angular was pointing at the whole time.
 */
export const ATLAS_MISSIONS_VM = new InjectionToken<TAtlasMissionsVM>("ATLAS_MISSIONS_VM");
