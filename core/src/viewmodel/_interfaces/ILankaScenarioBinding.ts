import type { TLankaReplayRequest } from "../../scenario/event-bus/lanka-event-bus-instance/LankaEventBusInstance";
import type { TLankaScenarioHandler } from "../_types/TLankaScenarioHandler";
import type { ILankaScenario } from "../../scenario/_interfaces/ILankaScenario";
import type { ILankaVMContext } from "./ILankaVMContext";

export interface ILankaScenarioBinding<
	TData,
	TState extends object,
	TGateways extends object,
	TServices extends object,
> {
	scenario: ILankaScenario<TData>;
	/**
	 * Bivariant handler allows passing stricter callback signatures
	 * (e.g. data?: TFeatureGroupsListRefreshEventData) while the
	 * lankaEventBus expects (data?: unknown) => void.
	 */
	handler: (ctx: ILankaVMContext<TState, TGateways, TServices>) => TLankaScenarioHandler<TData>;
	options?: {
		priority?: number;
		replay?: TLankaReplayRequest;
		usedBy?: string;
	};
}
