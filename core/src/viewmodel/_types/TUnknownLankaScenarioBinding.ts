import type { ILankaScenarioVM } from "../../scenario/_interfaces/ILankaScenarioVM";
import type { ILankaScenarioBinding } from "../_interfaces/ILankaScenarioBinding";

export type TUnknownLankaScenarioBinding<
	TState extends object,
	TGateways extends object,
	TServices extends object,
> = ILankaScenarioBinding<unknown, TState & ILankaScenarioVM, TGateways, TServices>;
