import { useLankaVM } from "@lankajs/react";
import type { ILankaReadableVM } from "lanka/viewmodel";
import type { IAtlasMissionsActions, IAtlasMissionsState } from "@lanka-playgrounds/_shared";

/**
 * The missions ViewModel, as every React screen in this ecosystem receives it.
 *
 * `ILankaReadableVM` and not the concrete builder's return: a screen reads and
 * acts, and nothing above it may call `setState`. The four applications spelled
 * this intersection out one prop at a time, which is four places to change when
 * the ViewModel gains a key.
 */
export type TAtlasMissionsVM = ILankaReadableVM<IAtlasMissionsState & IAtlasMissionsActions>;

/**
 * Read the missions ViewModel, and nothing more.
 *
 * The plain read, for a screen whose state arrived some other way — hydrated
 * from the server, or already fetched by a sibling. `useAtlasMissionsOnMount` is
 * the one that asks for data.
 *
 * It is a named hook rather than `useLankaVM(vm)` at each call site because the
 * ecosystem's read path is a decision, and a decision with four copies has no
 * place to be changed. The binding it delegates to is `@lankajs/react`'s — the
 * only member of the bindings shelf a React host may use.
 */
export const useAtlasMissions = (
	missionsVM: TAtlasMissionsVM,
): IAtlasMissionsState & IAtlasMissionsActions => useLankaVM(missionsVM);
