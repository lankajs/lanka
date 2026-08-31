import { ALankaSharedStore } from "../../_abstractions/lanka-shared-store/ALankaSharedStore";

/**
 * A shared store, without writing a class whose body is one function.
 *
 * A shared store is the third rung of the ladder in `core/README.md`: reach for
 * it only when several ViewModels must CO-EDIT one state. Most stores have no
 * behaviour of their own — the state and how to build it fresh is the whole
 * declaration — and this is the shape for those.
 *
 * One implementation: what comes back is an `ALankaSharedStore`, so a reset, a
 * subscription and the zustand api behave identically either way.
 */
export const createLankaSharedStore = <TState extends object>(
	createInitialState: () => TState,
): ALankaSharedStore<TState> => {
	class FunctionalSharedStore extends ALankaSharedStore<TState> {
		public constructor() {
			super(createInitialState);
		}
	}

	return new FunctionalSharedStore();
};
