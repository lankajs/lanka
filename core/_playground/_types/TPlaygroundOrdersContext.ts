import type { ILankaScenarioVM } from "../../src/scenario/index";
import type { ILankaVMContext } from "../../src/viewmodel/index";
import type { IPlaygroundOrderGateways } from "../_interfaces/IPlaygroundOrderGateways";
import type { IPlaygroundOrdersActions } from "../_interfaces/IPlaygroundOrdersActions";
import type { IPlaygroundOrdersServices } from "../_interfaces/IPlaygroundOrdersServices";
import type { IPlaygroundOrdersState } from "../_interfaces/IPlaygroundOrdersState";

/** What the framework hands the list ViewModel's action factory and hooks. */
export type TPlaygroundOrdersContext = ILankaVMContext<
	IPlaygroundOrdersState & IPlaygroundOrdersActions & ILankaScenarioVM,
	IPlaygroundOrderGateways,
	IPlaygroundOrdersServices
>;
