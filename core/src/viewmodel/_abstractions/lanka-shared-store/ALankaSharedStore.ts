import { createStore, StoreApi } from "zustand/vanilla";

/**
 * Base abstraction for shared feature stores.
 *
 * A store built on this class is resolved through the shared-store locator and
 * reused across several ViewModels.
 */
export abstract class ALankaSharedStore<TState extends object> {
	private readonly api: StoreApi<TState>;
	private readonly createInitialState: () => TState;

	protected constructor(createInitialState: () => TState) {
		this.createInitialState = createInitialState;
		this.api = createStore<TState>()(() => this.createInitialState());
	}

	public getApi(): StoreApi<TState> {
		return this.api;
	}

	public getState(): TState {
		return this.api.getState();
	}

	public setState(
		partial: TState | Partial<TState> | ((state: TState) => TState | Partial<TState>),
		replace?: boolean,
	): void {
		const resolved = typeof partial === "function" ? partial(this.api.getState()) : partial;

		if (replace) {
			this.api.setState(resolved as TState, true);
			return;
		}

		this.api.setState(resolved);
	}

	public subscribe(listener: (state: TState, prevState: TState) => void) {
		return this.api.subscribe(listener);
	}

	/**
	 * Back to what the store was built with.
	 *
	 * Public, and it was not: while this was `protected` only a subclass could
	 * reset, so the class style had a capability the functional one could not
	 * reach — the asymmetry `skills/parity/SKILL.md` forbids. A shared store needs
	 * explicit reset points (see the ladder in `core/README.md`), and the
	 * application that owns them is outside the class either way.
	 */
	public reset(): void {
		this.api.setState(this.createInitialState(), true);
	}
}
