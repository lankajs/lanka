/**
 * What a view binding needs of a ViewModel, and nothing else.
 *
 * The reading half: a name, the current state, a way to hear about the next one,
 * and whether this ViewModel wants access tracking. Writing is deliberately
 * absent — a binding renders, and a binding that could write would be a second
 * place actions live.
 *
 * ## Why this is the port and not `StoreApi`
 *
 * All three ViewModel shapes answer it, and they are built out of different
 * things: the stateful one over a store of its own, the shared-store one over a
 * slice of somebody else's, the stateless one over a plain object with no store
 * at all. A binding written against a store type would work for one of the three.
 *
 * It is also what keeps zustand inside core. `@lankajs/react`, `@lankajs/vue`
 * and every later member of the shelf see this interface and never `StoreApi`,
 * so the store underneath can change without a binding hearing about it — and if
 * a binding ever needs something zustand-shaped, the abstraction leaked and the
 * fix belongs here rather than there. Canon: `skills/hosts/SKILL.md` §1a.
 *
 * @see ILankaVM for the half that also writes, which `hydrateLankaVM` needs.
 */
export interface ILankaReadableVM<TState extends object> {
	/**
	 * Names the ViewModel in logs, the scenario registry and the blind-spot
	 * warning — and in whatever a binding's devtools shows.
	 */
	readonly name: string;

	/**
	 * The current state, in full — and the SAME object until something changes.
	 *
	 * The identity is part of the contract, not an accident of the six factories
	 * that keep it. Every binding on the shelf holds something against it: the
	 * access tracker caches its recording proxy by the identity of the state it
	 * wrapped, and `@lankajs/react` holds a selector's answer the same way. An
	 * implementation that composes a fresh object on every call hands React a
	 * snapshot that never agrees with itself between the render read and the
	 * post-commit one, and the component renders until React stops it — a crash
	 * whose stack names React and not the ViewModel.
	 *
	 * It costs an implementer nothing to keep: answer a held object, and build a
	 * new one when you write. A ViewModel that composes its state from somewhere
	 * else memoises the composition against what it composed from —
	 * `createSharedStoreLankaVM` is the worked example.
	 */
	getState(): TState;

	/**
	 * Hears about every change, with both states in FULL shape.
	 *
	 * A shared-store ViewModel composes its full state from a store slice, and
	 * does so HERE rather than in the binding: a binding compares two states, it
	 * does not know how one is assembled.
	 *
	 * A stateless ViewModel has nothing that changes, so its implementation
	 * returns an unsubscribe and never calls the listener. That is not a gap —
	 * it is what makes the same binding work for all three without asking which
	 * it was handed.
	 */
	subscribe(listener: (next: TState, prev: TState) => void): () => void;

	/**
	 * Whether this ViewModel wants a reader to track which keys it read.
	 *
	 * `enableAccessTrackingOptimization`, as a binding sees it. A binding that
	 * ignores it is not merely slower: the blind spot documented on `ALankaVM`
	 * becomes a frozen screen, because the ViewModel turned tracking OFF for
	 * exactly the reason that it derives what the view shows.
	 */
	readonly isAccessTracked: boolean;
}
