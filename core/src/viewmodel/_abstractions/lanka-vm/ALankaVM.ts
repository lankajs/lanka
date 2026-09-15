import { ALankaVMEnvironment } from "../lanka-vm-environment/ALankaVMEnvironment";
import { createStore, StoreApi } from "zustand/vanilla";
import { getLankaFlags } from "../../../config/get-lanka-flags/getLankaFlags";
import { createLankaBlindSpotTrap } from "../../_internal/create-lanka-blind-spot-trap/createLankaBlindSpotTrap";
import { createLankaScenarioBinder } from "../../_internal/create-lanka-scenario-binder/createLankaScenarioBinder";
import { lankaBlindSpotRegistry } from "../../_internal/lanka-blind-spot-registry/lankaBlindSpotRegistry";
import { ILankaScenarioVM } from "../../../scenario/_interfaces/ILankaScenarioVM";
import { lankaScenarioBootstrap } from "../../../scenario/lanka-scenario-bootstrap/LankaScenarioBootstrap";
import { lankaLogger } from "../../../logger/lanka-logger/LankaLogger";
import type { ILankaScenario } from "../../../scenario/_interfaces/ILankaScenario";
import type { ILankaVM } from "../../_interfaces/ILankaVM";
import type { ILankaVMContext } from "../../_interfaces/ILankaVMContext";
import type { TLankaVMEnhancer } from "../../_types/TLankaVMEnhancer";
import type { TLankaVMStateCreator } from "../../_types/TLankaVMStateCreator";
import type { TLankaScenarioBindingsDeclaration } from "../../_types/TLankaScenarioBindingsDeclaration";
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
 * `gateways` and `services` already name what they answer. `toLifecycleHooks`
 * is protected too and is not one of these: it is how the framework reads the
 * two hooks, and a ViewModel overrides the hooks, never it.
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

	/**
	 * The scenarios this ViewModel listens to, unsubscribed for it on reset.
	 *
	 * Returning a FACTORY postpones building the list until bind time, which is
	 * what a ViewModel declared at module level needs when its entries name their
	 * scenarios through the locator. See `TLankaScenarioBindingsDeclaration`.
	 */
	protected scenarioHandlers(): TLankaScenarioBindingsDeclaration<
		TUnknownLankaScenarioBinding<State & Actions, TGateways, Services>
	> {
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

	/**
	 * Builds the ViewModel a screen reads. One store per call.
	 *
	 * What comes back is a STORE, not a hook: `getState`, `subscribe`, `setState`,
	 * plus the name and the tracking flag. A screen reaches it through its
	 * framework's binding — `useLankaVM(todoVM)` from `@lankajs/react`,
	 * `@lankajs/vue` and the rest of the shelf — and a program with no framework
	 * at all reads `getState()` and `subscribe()` directly.
	 */
	public build(): ILankaVM<State & Actions & ILankaScenarioVM> {
		type TFullState = State & Actions & ILankaScenarioVM;

		lankaLogger.printViewModelLog("START Create VM", this.name);

		const blindSpot = createLankaBlindSpotTrap(
			this.name,
			getLankaFlags().isDevelopment === true,
		);

		// One binder per ViewModel, built OUTSIDE the state creator: a middleware may
		// run the creator more than once, and the binder's verdict on bootstrap is
		// read after the store exists. The bindings are passed through unopened — a
		// factory is called at bind time, which is the whole point of that form.
		const hooks = this.toLifecycleHooks();
		const { initializeScenario, resetScenario, needsBootstrap } = createLankaScenarioBinder({
			name: this.name,
			bindings: this.scenarioHandlers(),
			context: () => this.toStyleContext(),
			onInit: hooks.onInit,
			onReset: hooks.onReset,
		});

		const stateCreator: TLankaVMStateCreator<TFullState> = (set, get) => {
			this.set = set;
			this.get = blindSpot.observeGet(get);
			this.gateways = this.createGateways();
			this.services = this.createServices();

			const actions = blindSpot.observeActions(this.createActions());

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

		const store = createStore<TFullState>()(enhancedCreator);

		/**
		 * The two members the port adds to what a store already answers.
		 *
		 * A vanilla store is most of `ILankaVM` already — `getState`, `subscribe`,
		 * `getInitialState`, `setState` — and what it cannot know is who it belongs
		 * to and what this ViewModel decided about tracking. Attached rather than
		 * wrapped, so the object a screen holds IS the store: no extra hop, and
		 * every zustand middleware a consumer applied still reaches it.
		 *
		 * Non-enumerable, because they are a description of the ViewModel rather
		 * than part of its state, and a spread of the store should not pick them up.
		 */
		const viewModel: ILankaVM<TFullState> = Object.defineProperties(store, {
			name: { value: this.name, enumerable: false, configurable: true },
			isAccessTracked: {
				value: this.enableAccessTrackingOptimization,
				enumerable: false,
				configurable: true,
			},
		}) as unknown as ILankaVM<TFullState>;

		lankaBlindSpotRegistry.remember(viewModel, blindSpot);

		if (needsBootstrap) {
			lankaScenarioBootstrap.registerViewModel(store.getState(), this.name);
		}

		lankaLogger.printViewModelLog("FINISH Create VM", this.name);

		return viewModel;
	}
}
