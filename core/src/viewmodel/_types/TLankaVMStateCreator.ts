import type { StateCreator } from "zustand";
import type { TLankaAnyMutators } from "./TLankaAnyMutators";

export type TLankaVMStateCreator<TFullState> = StateCreator<
	TFullState,
	TLankaAnyMutators,
	TLankaAnyMutators
>;
