import type { StoreApi } from "zustand";
import type { ILankaScenario } from "../../scenario/_interfaces/ILankaScenario";

export interface ILankaVMContext<TState, TGateways extends object, TServices extends object> {
	set: StoreApi<TState>["setState"];
	get: () => TState;
	gateways: TGateways;
	services: TServices;
	trigger: <T>(scenario: ILankaScenario<T>, data?: T) => void;
}
