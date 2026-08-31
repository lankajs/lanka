import type { StateCreator } from "zustand";
import type { TLankaAnyMutators } from "./TLankaAnyMutators";

export type TLankaVMEnhancer<TState> = (
	creator: StateCreator<TState, TLankaAnyMutators, TLankaAnyMutators>,
) => StateCreator<TState, TLankaAnyMutators, TLankaAnyMutators>;
