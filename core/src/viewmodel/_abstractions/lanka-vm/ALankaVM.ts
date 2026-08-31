import { ALankaVMEnvironment } from "../lanka-vm-environment/ALankaVMEnvironment";
import { create, StoreApi, UseBoundStore } from "zustand";
import { getLankaFlags } from "../../../config/get-lanka-flags/getLankaFlags";
import { createLankaBlindSpotTrap } from "../../_internal/create-lanka-blind-spot-trap/createLankaBlindSpotTrap";
import { createLankaScenarioBinder } from "../../_internal/create-lanka-scenario-binder/createLankaScenarioBinder";
import { createLankaTrackedHook } from "../../_internal/create-lanka-tracked-hook/createLankaTrackedHook";
import { ILankaScenarioVM } from "../../../scenario/_interfaces/ILankaScenarioVM";
import { lankaScenarioBootstrap } from "../../../scenario/lanka-scenario-bootstrap/LankaScenarioBootstrap";
import { lankaLogger } from "../../../logger/lanka-logger/LankaLogger";
import type { ILankaScenario } from "../../../scenario/_interfaces/ILankaScenario";
import type { ILankaVMContext } from "../../_interfaces/ILankaVMContext";
import type { TLankaVMEnhancer } from "../../_types/TLankaVMEnhancer";
import type { TLankaVMStateCreator } from "../../_types/TLankaVMStateCreator";
import type { TUnknownLankaScenarioBinding } from "../../_types/TUnknownLankaScenarioBinding";

/**
 * A ViewModel written as a class: the state a screen reads, and the only place a
 * gateway is called from.
 *
 * This is the implementation of the role, and `createLankaVM` is the same thing
 * reached the other way — a subclass built from an options object. Neither style
 * can do what the other cannot, because there is nothing here to diverge from.
 *
 * The protected surface IS the functional context, member for member:
 * `set`, `get`, `gateways`, `services`, `trigger`. What the config supplies as a
 * value or a thunk, the class supplies by overriding a method of the same name —
 * `states`, `scenarioHandlers`, `enhancers`, `onInit`, `onReset` — with the two
 * dependency suppliers named `createGateways` and `createServices`, because
 * `gateways` and `services` already name what they answer.
 *
 * ```ts
 * class TodoVM extends ALankaVM<ITodoState, ITodoActions, ITodoGateways> {
 * 	protected readonly name = "TodoVM";
 *
 * 	protected states(): ITodoState {
 * 		return { todos: [], isLoading: false };
 * 	}
 *
 * 	protected createGateways(): ITodoGateways {
 * 		return { todo: new TodoGateway() };
 * 	}
 *
 * 	protected createActions(): ITodoActions {
 * 		return {
 * 			load: async () => {
 * 				this.set({ isLoading: true });
 * 				this.set({ todos: await this.gateways.todo.list(), isLoading: false });
 * 			},
 * 		};
 * 	}
 * }
 *
 * export const useTodoVM = new TodoVM().build();
 * ```
 *
 * The access-tracking blind spot the functional style documents is the same one
 * here, and `enableAccessTrackingOptimization` is the same switch. A consumer
 * re-renders only for state keys it READ off the returned proxy; an action that
 * DERIVES a value reads the store through `get`, which the proxy never sees, so a
 * component whose only link to a key is such a getter never re-renders for it. In
 * development the mismatch announces itself by name rather than by a frozen
 * screen. Canon: `skills/parity/SKILL.md`.
 */
export abstract class ALankaVM<
	State extends object,
	Actions extends object,
	TGateways extends object = Record<string, never>,
	Services extends object = Record<string, never>,
> extends ALankaVMEnvironment<TGateways, Services> {
	/** Names the ViewModel in the logs, the scenario registry and the blind-spot warning. */
	protected abstract readonly name: string;

	/**
	 * Turn off when one broad consumer reads most fields, or when an action derives
	 * what the screen shows — proxy tracking then costs more than it saves, and in
	 * the second case it cannot see the read at all.
	 */
	protected readonly enableAccessTrackingOptimization: boolean = true;

	/** Writes state. Available from `createActions` onwards, never before. */
	protected set!: StoreApi<State & Actions & ILankaScenarioVM>["setState"];

	/** Reads state. The read a tracked hook cannot see — hence the switch above. */
	protected get!: () => State & Actions & ILankaScenarioVM;

	/** Fires a scenario, which every ViewModel bound to it then hears. */
	protected trigger = <TData>(scenario: ILankaScenario<TData>, data?: TData): void => {
		scenario.trigger(data);
	};

	/** The reactive fields the screen reads. */
	protected states(): State {
		return {} as State;
	}

	/** The scenarios this ViewModel listens to, unsubscribed for it on reset. */
	protected scenarioHandlers(): TUnknownLankaScenarioBinding<
		State & Actions,
		TGateways,
		Services
	>[] {
		return [];
	}

	/** Store middleware — `persist`, `lankaDevtools` — the last one applied outermost. */
	protected enhancers(): TLankaVMEnhancer<State & Actions & ILankaScenarioVM>[] {
		return [];
	}

	/** The actions the screen calls. Written against `this.set` and `this.get`. */
	protected abstract createActions(): Actions;

	/**
	 * The protected surface as an object, for the functional style.
	 *
	 * Assembled INSIDE the class because that is the only place `protected` can be
	 * read — a context built from outside could carry only the public half, which is
	 * the wrong half. Canon: `skills/parity/SKILL.md` section 3a.
	 */
	protected toStyleContext(): ILankaVMContext<
		State & Actions & ILankaScenarioVM,
		TGateways,
		Services
	> {
		return {
			set: this.set,
			get: this.get,
			gateways: this.gateways,
			services: this.services,
			trigger: this.trigger,
		};
	}

	/** Builds the hook a screen calls. One store per call. */
	public build(): UseBoundStore<StoreApi<State & Actions & ILankaScenarioVM>> {
		type TFullState = State & Actions & ILankaScenarioVM;

		lankaLogger.printViewModelLog("START Create VM", this.name);

		const blindSpot = createLankaBlindSpotTrap(
			this.name,
			getLankaFlags().isDevelopment === true,
		);

		// Asked once. Every call builds a fresh array, and this one used to be made
		// twice per ViewModel: once to bind the scenarios, once to decide whether to
		// register the ViewModel at all.
		const bindings = this.scenarioHandlers();

		const stateCreator: TLankaVMStateCreator<TFullState> = (set, get) => {
			this.set = set;
			this.get = blindSpot.observeGet(get);
			this.gateways = this.createGateways();
			this.services = this.createServices();

			const actions = blindSpot.observeActions(this.createActions());

			const { initializeScenario, resetScenario } = createLankaScenarioBinder({
				name: this.name,
				bindings,
				context: () => this.toStyleContext(),
				onInit: () => {
					this.onInit();
				},
				onReset: () => {
					this.onReset();
				},
			});

			return {
				...this.states(),
				...actions,
				initializeScenario,
				resetScenario,
			};
		};

		const enhancedCreator = this.enhancers().reduce<TLankaVMStateCreator<TFullState>>(
			(creator, enhance) => enhance(creator),
			stateCreator,
		);

		const store = create<TFullState>()(enhancedCreator);

		const registerScenarioViewModel = (viewModel: ILankaScenarioVM): void => {
			if (bindings.length > 0) {
				lankaScenarioBootstrap.registerViewModel(viewModel, this.name);
			}
		};

		if (!this.enableAccessTrackingOptimization) {
			registerScenarioViewModel(store.getState());
			lankaLogger.printViewModelLog("FINISH Create VM", this.name);

			return store;
		}

		const useOptimizedViewModel = createLankaTrackedHook<TFullState>({
			subscribe: (onChange) => store.subscribe(onChange),
			readState: () => store.getState(),
			onUntrackedChange: blindSpot.isArmed ? blindSpot.report : undefined,
		}) as UseBoundStore<StoreApi<TFullState>>;

		useOptimizedViewModel.setState = store.setState;
		useOptimizedViewModel.getState = store.getState;
		useOptimizedViewModel.getInitialState = store.getInitialState;
		useOptimizedViewModel.subscribe = store.subscribe;

		registerScenarioViewModel(useOptimizedViewModel.getState());

		lankaLogger.printViewModelLog("FINISH Create VM", this.name);

		return useOptimizedViewModel;
	}
}
