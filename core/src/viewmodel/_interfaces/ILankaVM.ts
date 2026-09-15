import type { ILankaReadableVM } from "./ILankaReadableVM";

/**
 * A ViewModel that can also be written to from outside.
 *
 * The reading half plus the two members a host needs: the state a screen starts
 * from, and a way to make server data that first state — which is what
 * `hydrateLankaVM` does and the only reason writing is published at all.
 *
 * A view binding takes `ILankaReadableVM` instead. The narrower type is not
 * politeness: a binding holding this one could write during a render, which is
 * the defect no framework's scheduler survives.
 */
export interface ILankaVM<TState extends object> extends ILankaReadableVM<TState> {
	/** The state the ViewModel was built with, before anything wrote to it. */
	getInitialState(): TState;

	/** Writes state. Partial by default; `replace` swaps the whole object. */
	setState(
		partial: TState | Partial<TState> | ((state: TState) => TState | Partial<TState>),
		replace?: false,
	): void;
}
