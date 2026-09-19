/**
 * Compares two selections one level deep.
 *
 * Own keys, same count, `Object.is` on each value. Arrays included, because an
 * array IS an object with numeric keys and a selection like `state.todos.map(…)`
 * is the commonest thing there is.
 *
 * Unbranded, because it is a pure function over plain values and holds nothing —
 * `skills/naming/SKILL.md`, the prefix table. Not exported: what a consumer
 * needs is the hold below, and a second name for the predicate would be a second
 * promise to keep.
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
 * Keeps a selection's IDENTITY while nothing in it moved.
 *
 * ```ts
 * const hold = createLankaShallowHold<{ title: string; status: string }>();
 *
 * // in any binding on the shelf
 * const view = useLankaVM(missionVM, (state) => hold({
 * 	title: state.title,
 * 	status: state.status,
 * }));
 * ```
 *
 * ## What it is for
 *
 * A selector narrows what a reader depends on, and a selector that BUILDS its
 * answer — `(state) => ({ a: state.a })`, `(state) => rows.filter(…)`, the shape
 * a consumer reaches for first — cannot say so. Every binding compares the new
 * selection with the last one by identity, and a fresh object is never identical
 * to anything, so the reader wakes for every change in the ViewModel including
 * the keys the selector exists to ignore. This is the comparison that makes the
 * selection mean something.
 *
 * A selector answering a PRIMITIVE never needed it, which is what makes the cost
 * quiet: the shape that is free and the shape that repaints on everything look
 * the same on the page.
 *
 * ## Why it is in core and not in a binding
 *
 * It was `useLankaShallow` in `@lankajs/react` and nowhere else, and that made it
 * a CAPABILITY one member of the shelf had and four did not. An idiom is a
 * spelling; this changes which notifications reach a reader, and it encodes a
 * policy — one level deep, own keys, `Object.is` — that five packages inventing
 * separately would answer five ways. `skills/parity/SKILL.md` 3c: a binding that
 * needs more than the port gives it has found something that belongs in core, for
 * everybody.
 *
 * `useLankaShallow` keeps working and is now React's spelling over this. It has
 * to exist there and cannot exist here: a React component re-runs the hook on
 * every render, so the holding has to survive a render while the SELECTOR stays
 * the current one — which is a `useRef`, and a ref is not something core can
 * have.
 *
 * ## Why it holds a value and not a selector
 *
 * `createLankaShallowSelector(selector)` was the other shape and it cannot serve
 * React: the wrapper would be rebuilt whenever the selector's identity moved, and
 * an inline arrow is a new function every render, so the holding would reset
 * before it ever held anything. Taking the VALUE puts the state in the only place
 * every framework can keep it, and the extra line at a call site is the price of
 * one name that works in all five rather than two that each work in some.
 *
 * ## One level, and it says so by failing
 *
 * Deeper would mean walking a state of unknown size on every read, which is the
 * cost a reader took a selector to avoid. A selection with a nested object wants
 * a selector that picks the leaves.
 */
export const createLankaShallowHold = <TValue>(): ((next: TValue) => TValue) => {
	let held: TValue | undefined;
	let holding = false;

	return (next: TValue): TValue => {
		// `holding` rather than `held !== undefined`: a selection that legitimately
		// answers `undefined` is a selection, and a flag is the difference between
		// "nothing yet" and "nothing, and that is the answer".
		if (holding && isShallowEqual(held, next)) return held as TValue;

		holding = true;
		held = next;

		return next;
	};
};
