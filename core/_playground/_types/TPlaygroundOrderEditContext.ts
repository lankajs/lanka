import type { ILankaScenarioVM } from "../../src/scenario/index";
import type { ILankaVMContext } from "../../src/viewmodel/index";
import type { IPlaygroundOrderEditActions } from "../_interfaces/IPlaygroundOrderEditActions";
import type { IPlaygroundOrderEditState } from "../_interfaces/IPlaygroundOrderEditState";
import type { IPlaygroundOrderGateways } from "../_interfaces/IPlaygroundOrderGateways";
import type { IPlaygroundOrderServices } from "../_interfaces/IPlaygroundOrderServices";

/** What the framework hands the edit ViewModel's action factory and handlers. */
export type TPlaygroundOrderEditContext = ILankaVMContext<
	IPlaygroundOrderEditState & IPlaygroundOrderEditActions & ILankaScenarioVM,
	IPlaygroundOrderGateways,
	IPlaygroundOrderServices
>;
