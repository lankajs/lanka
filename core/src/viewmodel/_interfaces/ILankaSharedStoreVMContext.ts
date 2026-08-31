import type { StoreApi } from "zustand/vanilla";
import type { ILankaScenario } from "../../scenario/_interfaces/ILankaScenario";
import type { ALankaSharedStore } from "../_abstractions/lanka-shared-store/ALankaSharedStore";

export interface ILankaSharedStoreVMContext<
	TStoreState extends object,
	TFullState extends object,
	TStore extends ALankaSharedStore<TStoreState>,
	TGateways extends object,
	TServices extends object,
> {
	set: StoreApi<TStoreState>["setState"];
	getStore: () => TStoreState;
	get: () => TFullState;
	store: TStore;
	gateways: TGateways;
	services: TServices;
	trigger: <T>(scenario: ILankaScenario<T>, data?: T) => void;
}
