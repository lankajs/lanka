import type { ILankaScenarioVM } from "../../scenario/_interfaces/ILankaScenarioVM";
import type { ILankaVMContext } from "./ILankaVMContext";
import type { TUnknownLankaScenarioBinding } from "../_types/TUnknownLankaScenarioBinding";
import type { TLankaVMEnhancer } from "../_types/TLankaVMEnhancer";

export interface ILankaVMConfig<
	State extends object,
	Actions extends object,
	TGateways extends object = Record<string, never>,
	Services extends object = Record<string, never>,
> {
	name: string;
	/**
	 * Enables access-tracking optimization for no-selector hook usage.
	 * Disable when the ViewModel is consumed by a single broad consumer
	 * that reads most fields, because proxy tracking overhead may outweigh gains.
	 */
	enableAccessTrackingOptimization?: boolean;
	states?: State;
	createActions: (
		ctx: ILankaVMContext<State & Actions & ILankaScenarioVM, TGateways, Services>,
	) => Actions;
	scenarioHandlers?: TUnknownLankaScenarioBinding<State & Actions, TGateways, Services>[];
	/** Non-gateway services. */
	services?: Services | (() => Services);
	/** TGateways (data layer) separated from services. */
	gateways?: TGateways | (() => TGateways);
	enhancers?: TLankaVMEnhancer<State & Actions & ILankaScenarioVM>[];
	onInit?: (
		ctx: ILankaVMContext<State & Actions & ILankaScenarioVM, TGateways, Services>,
	) => void;
	onReset?: (
		ctx: ILankaVMContext<State & Actions & ILankaScenarioVM, TGateways, Services>,
	) => void;
}
