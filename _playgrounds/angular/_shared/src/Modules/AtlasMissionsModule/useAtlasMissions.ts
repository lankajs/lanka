import { useLankaVM } from "@lankajs/angular";
import type { Signal } from "@angular/core";
import type { ILankaReadableVM } from "lanka/viewmodel";
import type { IAtlasMissionsActions, IAtlasMissionsState } from "@lanka-playgrounds/_shared";

/**
 * The missions ViewModel, as every Angular screen in this ecosystem receives it.
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
 * It answers a `Signal`, which is Angular's own shape: `missions().rows()` in a
 * template marks the view dirty exactly when a key the reader looked at moves,
 * and zoneless change detection needs nothing else. `toLankaSignals` is the
 * other spelling — one signal per key, for a component that wants to pass `rows`
 * to a child as an input — and `toLankaObservable` is there for a codebase whose
 * every screen is already an `async` pipe.
 *
 * ## It must be called in an injection context
 *
 * A field initialiser, a constructor or an explicit `runInInjectionContext`. The
 * binding asserts it rather than assuming it, because the subscription is torn
 * down by `DestroyRef` — and a call made outside a context has no `DestroyRef`
 * to register with, which is a leak rather than an error.
 */
export const useAtlasMissions = (
	missionsVM: TAtlasMissionsVM,
): Signal<IAtlasMissionsState & IAtlasMissionsActions> => useLankaVM(missionsVM);
