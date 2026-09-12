import type { ILankaScenarioVM } from "../../src/scenario/index";
import type { ILankaVMContext } from "../../src/viewmodel/index";
import type { IPlaygroundOrderGateways } from "../_interfaces/IPlaygroundOrderGateways";
import type { IPlaygroundRenameActions } from "../_interfaces/IPlaygroundRenameActions";
import type { IPlaygroundRenameState } from "../_interfaces/IPlaygroundRenameState";

/** What the framework hands the rename ViewModel's action factory. */
export type TPlaygroundRenameContext = ILankaVMContext<
	IPlaygroundRenameState & IPlaygroundRenameActions & ILankaScenarioVM,
	IPlaygroundOrderGateways,
	Record<string, never>
>;
