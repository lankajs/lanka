import { useRef } from "react";

/**
 * Compares two selections one level deep.
 *
 * Own keys, same count, `Object.is` on each value. Arrays included, because an
 * array IS an object with numeric keys and a selection like `state.todos.map(…)`
 * is the commonest thing there is.
 *
 * Fifteen lines rather than a dependency, which is the order the parity canon
 * sets for an idiom: the framework's own library, then what it already requires,
 * then this, and only then somebody else's package.
 */
const isShallowEqual = (a: unknown, b: unknown): boolean => {
	if (Object.is(a, b)) return true;
	if (typeof a !== "object" || a === null || typeof b !== "object" || b === null) return false;

	const left = Object.keys(a);
	const right = Object.keys(b);
	if (left.length !== right.length) return false;

	return left.every(
		(key) =>
			Object.hasOwn(b as Record<string, unknown>, key) &&
			Object.is((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
	);
};

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
 * depth exceeded". That is closed in the binding, for the same reason it is not
 * closed here: the other four bindings never crashed, and a hole one member of
 * the shelf patches with a wrapper is a promise that means five different
 * things. `lankaViewBindingConformance` holds all five to it now.
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
 *
 * ## The ref, and why writing it here is not an impure render
 *
 * The ref is written inside the RETURNED function, which `useSyncExternalStore`
 * calls — not in the render body. That is the same arrangement zustand ships,
 * and it is what lets the comparison remember anything at all.
 */
export const useLankaShallow = <TState, TSelected>(
	selector: (state: TState) => TSelected,
): ((state: TState) => TSelected) => {
	const previous = useRef<TSelected | undefined>(undefined);

	return (state: TState): TSelected => {
		const next = selector(state);

		if (previous.current !== undefined && isShallowEqual(previous.current, next)) {
			return previous.current;
		}

		previous.current = next;

		return next;
	};
};
