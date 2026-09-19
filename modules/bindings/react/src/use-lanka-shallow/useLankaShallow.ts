import { useRef } from "react";
import { createLankaShallowHold } from "lanka/viewmodel";

/**
 * Keeps a selector's answer stable when nothing in it changed.
 *
 * ```tsx
 * const { title, status } = useLankaVM(missionVM, useLankaShallow((s) => ({
 * 	title: s.title,
 * 	status: s.status,
 * })));
 * ```
 *
 * ## The waste this exists for
 *
 * `useLankaVM(vm, (s) => ({ a: s.a }))` is the commonest thing a React reader
 * writes, and unwrapped it wakes the component for EVERY change in the
 * ViewModel. The binding holds a selection against the state object it came
 * from, which is what a snapshot has to be; a fresh object is new whenever the
 * state is new, so a reader that took a selector to say "only `a`" is repainted
 * by a change to `z`. This is the comparison that makes the statement mean
 * something.
 *
 * A selector returning a primitive never had the problem, which is what makes
 * the waste quiet: the shape that is free and the shape that repaints on
 * everything look the same on the page.
 *
 * It used to be worse. Until `useLankaVM` ran its selector once per state
 * object, an unwrapped one CRASHED — `useSyncExternalStore` reads the snapshot
 * during render and again after committing, a fresh object disagreed with
 * itself, and the component rendered until React stopped it with "Maximum update
 * depth exceeded". That is closed in the binding, for everybody.
 *
 * ## What is React's here, and what is not
 *
 * The comparison is `createLankaShallowHold` in core, and every binding on the
 * shelf can reach it. It was this file's, and that made it a CAPABILITY React had
 * and four siblings did not — an idiom is a spelling, and this changes which
 * notifications reach a reader. `skills/parity/SKILL.md` 3c.
 *
 * What is left is the part only React needs. A component re-runs this hook on
 * every render, so the holding has to SURVIVE a render while the selector stays
 * the current one: the hold lives in a ref initialised once, and the closure
 * returned below closes over this render's `selector`. A selector computed from
 * props therefore stays honest, and the hold does not reset under it.
 *
 * ## Why a wrapper and not an equality argument
 *
 * `useLankaVM(vm, selector, isEqual)` was the other option, and it puts the
 * comparison in the binding for every caller — including the ones whose
 * selection is a string and pay for a comparison they cannot fail. This is opt
 * in at the call site, which is also where a reader can see it.
 *
 * The shape is React's own: a hook that returns a selector. A consumer arriving
 * from zustand has typed `useShallow` and needs no explanation, which is the
 * whole point of an idiom.
 */
export const useLankaShallow = <TState, TSelected>(
	selector: (state: TState) => TSelected,
): ((state: TState) => TSelected) => {
	const hold = useRef<((next: TSelected) => TSelected) | null>(null);
	hold.current ??= createLankaShallowHold<TSelected>();

	return (state: TState): TSelected => hold.current!(selector(state));
};
