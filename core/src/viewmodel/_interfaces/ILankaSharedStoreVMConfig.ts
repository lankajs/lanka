import type { TLankaReplayRequest } from "../../scenario/event-bus/lanka-event-bus-instance/LankaEventBusInstance";
import type { TLankaScenarioHandler } from "../_types/TLankaScenarioHandler";
import type { ILankaScenario } from "../../scenario/_interfaces/ILankaScenario";
import type { ILankaScenarioVM } from "../../scenario/_interfaces/ILankaScenarioVM";
import type { ALankaSharedStore } from "../_abstractions/lanka-shared-store/ALankaSharedStore";
import type { ILankaSharedStoreVMContext } from "./ILankaSharedStoreVMContext";

export type TLankaSharedStoreVMHook<TStoreState extends object, TActions extends object> = {
	<TSelected = TStoreState & TActions & ILankaScenarioVM>(
		selector?: (full: TStoreState & TActions & ILankaScenarioVM) => TSelected,
	): TSelected;
	getState: () => TStoreState & TActions & ILankaScenarioVM;
	getStoreState: () => TStoreState;
};

export interface ILankaSharedStoreScenarioBinding<
	TData,
	TStoreState extends object,
	TActions extends object,
	TStore extends ALankaSharedStore<TStoreState>,
	TGateways extends object,
	TServices extends object,
> {
	scenario: ILankaScenario<TData>;
	/**
	 * Bivariant handler allows stricter callback signatures while lankaEventBus expects unknown.
	 */
	handler: (
		ctx: ILankaSharedStoreVMContext<
			TStoreState,
			TStoreState & TActions & ILankaScenarioVM,
			TStore,
			TGateways,
			TServices
		>,
	) => TLankaScenarioHandler<TData>;
	options?: {
		priority?: number;
		replay?: TLankaReplayRequest;
		usedBy?: string;
	};
}

export interface ILankaSharedStoreVMConfig<
	TStoreState extends object,
	TActions extends object,
	TStore extends ALankaSharedStore<TStoreState>,
	TGateways extends object = Record<string, never>,
	TServices extends object = Record<string, never>,
> {
	name: string;
	/**
	 * Enables access-tracking optimization for no-selector hook usage.
	 * Disable when one broad consumer reads most store fields and updates are frequent.
	 */
	enableAccessTrackingOptimization?: boolean;
	store: TStore;
	createActions: (
		ctx: ILankaSharedStoreVMContext<
			TStoreState,
			TStoreState & TActions & ILankaScenarioVM,
			TStore,
			TGateways,
			TServices
		>,
	) => TActions;
	scenarioHandlers?: ILankaSharedStoreScenarioBinding<
		unknown,
		TStoreState,
		TActions,
		TStore,
		TGateways,
		TServices
	>[];
	services?: TServices | (() => TServices);
	gateways?: TGateways | (() => TGateways);
	onInit?: (
		ctx: ILankaSharedStoreVMContext<
			TStoreState,
			TStoreState & TActions & ILankaScenarioVM,
			TStore,
			TGateways,
			TServices
		>,
	) => void;
	onReset?: (
		ctx: ILankaSharedStoreVMContext<
			TStoreState,
			TStoreState & TActions & ILankaScenarioVM,
			TStore,
			TGateways,
			TServices
		>,
	) => void;
}
