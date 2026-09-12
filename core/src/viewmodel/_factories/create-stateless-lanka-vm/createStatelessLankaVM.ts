import type { TLankaReplayRequest } from "../../../scenario/event-bus/lanka-event-bus-instance/LankaEventBusInstance";
import type { TLankaScenarioHandler } from "../../_types/TLankaScenarioHandler";
import type { TLankaScenarioBindingsDeclaration } from "../../_types/TLankaScenarioBindingsDeclaration";
import { resolveLankaDependency } from "../../_utils/resolve-lanka-dependency/resolveLankaDependency";
import { ALankaStatelessVM } from "../../_abstractions/lanka-stateless-vm/ALankaStatelessVM";
import { ILankaScenario } from "../../../scenario/_interfaces/ILankaScenario";
import { ILankaScenarioVM } from "../../../scenario/_interfaces/ILankaScenarioVM";

export type TLankaSetState<TState> = (
	partial: TState | Partial<TState> | ((state: TState) => TState | Partial<TState>),
	replace?: boolean,
) => void;

export interface ILankaStatelessVMContext<
	TState,
	TGateways extends object,
	TServices extends object,
> {
	set: TLankaSetState<TState>;
	get: () => TState;
	gateways: TGateways;
	services: TServices;
	trigger: <T>(scenario: ILankaScenario<T>, data?: T) => void;
}

export interface ILankaStatelessScenarioBinding<
	TData,
	TState extends object,
	TGateways extends object,
	TServices extends object,
> {
	scenario: ILankaScenario<TData>;
	handler: (
		ctx: ILankaStatelessVMContext<TState, TGateways, TServices>,
	) => TLankaScenarioHandler<TData>;
	options?: {
		priority?: number;
		replay?: TLankaReplayRequest;
		usedBy?: string;
	};
}

export type TLankaStatelessVMConfig<
	Actions extends object,
	TGateways extends object = Record<string, never>,
	Services extends object = Record<string, never>,
> = {
	name: string;
	createActions: (
		ctx: ILankaStatelessVMContext<Actions & ILankaScenarioVM, TGateways, Services>,
	) => Actions;
	/** A FACTORY is read at bind time — see `TLankaScenarioBindingsDeclaration`. */
	scenarioHandlers?: TLankaScenarioBindingsDeclaration<
		ILankaStatelessScenarioBinding<unknown, Actions & ILankaScenarioVM, TGateways, Services>
	>;
	services?: Services | (() => Services);
	gateways?: TGateways | (() => TGateways);
	onInit?: (
		ctx: ILankaStatelessVMContext<Actions & ILankaScenarioVM, TGateways, Services>,
	) => void;
	onReset?: (
		ctx: ILankaStatelessVMContext<Actions & ILankaScenarioVM, TGateways, Services>,
	) => void;
};

export type TLankaStatelessVMHook<Actions extends object> = {
	<TSelected = Actions & ILankaScenarioVM>(
		selector?: (full: Actions & ILankaScenarioVM) => TSelected,
	): TSelected;
	getState: () => Actions & ILankaScenarioVM;
};

export function createStatelessLankaVM<Actions extends object>(
	config: TLankaStatelessVMConfig<Actions, Record<string, never>, Record<string, never>>,
): TLankaStatelessVMHook<Actions>;

export function createStatelessLankaVM<Actions extends object, Services extends object>(
	config: TLankaStatelessVMConfig<Actions, Record<string, never>, Services>,
): TLankaStatelessVMHook<Actions>;

export function createStatelessLankaVM<Actions extends object, TGateways extends object>(
	config: TLankaStatelessVMConfig<Actions, TGateways, Record<string, never>>,
): TLankaStatelessVMHook<Actions>;

export function createStatelessLankaVM<
	Actions extends object,
	TGateways extends object,
	Services extends object,
>(config: TLankaStatelessVMConfig<Actions, TGateways, Services>): TLankaStatelessVMHook<Actions>;

/**
 * The functional style of `ALankaStatelessVM`: actions declared as an options object.
 *
 * Same outward shape as the stateful factory — a hook-like function with
 * `getState` — and no zustand store under it, because a ViewModel that holds
 * nothing has nothing to subscribe to. What it is and how it binds scenarios is
 * documented once, on the class.
 */
export function createStatelessLankaVM<
	Actions extends object,
	TGateways extends object = Record<string, never>,
	Services extends object = Record<string, never>,
>(config: TLankaStatelessVMConfig<Actions, TGateways, Services>): TLankaStatelessVMHook<Actions> {
	/**
	 * The bridge subclass lives here rather than in a shared helper because
	 * `toStyleContext` is `protected`: only a class body deriving from
	 * `ALankaStatelessVM` may read it. Canon: `skills/parity/SKILL.md` section 3a.
	 */
	class FunctionalStatelessVM extends ALankaStatelessVM<Actions, TGateways, Services> {
		protected readonly name = config.name;

		protected override scenarioHandlers(): NonNullable<typeof config.scenarioHandlers> {
			return config.scenarioHandlers ?? [];
		}

		protected override createGateways(): TGateways {
			return resolveLankaDependency(config.gateways);
		}

		protected override createServices(): Services {
			return resolveLankaDependency(config.services);
		}

		protected createActions(): Actions {
			return config.createActions(this.toStyleContext());
		}

		// Own properties, assigned only when declared — see the same constructor in
		// `createLankaVM` for why not a method override.
		public constructor() {
			super();
			const { onInit, onReset } = config;

			if (onInit) this.onInit = () => onInit(this.toStyleContext());
			if (onReset) this.onReset = () => onReset(this.toStyleContext());
		}
	}

	return new FunctionalStatelessVM().build();
}
