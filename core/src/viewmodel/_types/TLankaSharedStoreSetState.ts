export type TLankaSharedStoreSetState<TState extends object> = (
	partial: TState | Partial<TState> | ((state: TState) => TState | Partial<TState>),
	replace?: boolean,
) => void;
