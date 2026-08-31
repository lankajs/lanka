import { ALankaVMEnvironment } from "../lanka-vm-environment/ALankaVMEnvironment";
import { ILankaScenarioVM } from "../../../scenario/_interfaces/ILankaScenarioVM";
import { lankaScenarioBootstrap } from "../../../scenario/lanka-scenario-bootstrap/LankaScenarioBootstrap";
import { lankaLogger } from "../../../logger/lanka-logger/LankaLogger";
import { createLankaScenarioBinder } from "../../_internal/create-lanka-scenario-binder/createLankaScenarioBinder";
import type { ILankaScenario } from "../../../scenario/_interfaces/ILankaScenario";
import type {
	ILankaStatelessScenarioBinding,
	ILankaStatelessVMContext,
	TLankaSetState,
	TLankaStatelessVMHook,
} from "../../_factories/create-stateless-lanka-vm/createStatelessLankaVM";

/**
 * A ViewModel that holds no reactive state: actions, and what they orchestrate.
 *
 * The second rung of the ladder in `core/README.md` written as a class. A screen
 * that reads nothing and only DOES things — a sign-out, a share sheet, a form
 * whose fields live in the form library — pays for a zustand store it never
 * reads; this is the same role without one.
 *
 * The protected surface IS the functional context, member for member: `set`,
 * `get`, `gateways`, `services`, `trigger`. What the config supplies as a value
 * or a thunk, the class supplies by overriding a method of the same name, with
 * the two dependency suppliers named `createGateways` and `createServices`
 * because `gateways` and `services` already name what they answer.
 *
 * ```ts
 * class SessionVM extends ALankaStatelessVM<ISessionActions, ISessionGateways> {
 * 	protected readonly name = "SessionVM";
 *
 * 	protected createGateways(): ISessionGateways {
 * 		return { session: new SessionGateway() };
 * 	}
 *
 * 	protected createActions(): ISessionActions {
 * 		return {
 * 			signOut: async () => {
 * 				await this.gateways.session.signOut();
 * 				this.trigger(sessionEnded);
 * 			},
 * 		};
 * 	}
 * }
 *
 * export const useSessionVM = new SessionVM().build();
 * ```
 *
 * Canon: `skills/parity/SKILL.md`.
 */
export abstract class ALankaStatelessVM<
	Actions extends object,
	TGateways extends object = Record<string, never>,
	Services extends object = Record<string, never>,
> extends ALankaVMEnvironment<TGateways, Services> {
	/** Names the ViewModel in the logs, the scenario registry and any warning. */
	protected abstract readonly name: string;

	/** Writes state. Available from `createActions` onwards, never before. */
	protected set!: TLankaSetState<Actions & ILankaScenarioVM>;

	/** Reads what the actions have written, including the actions themselves. */
	protected get!: () => Actions & ILankaScenarioVM;

	/** Fires a scenario, which every ViewModel bound to it then hears. */
	protected trigger = <TData>(scenario: ILankaScenario<TData>, data?: TData): void => {
		scenario.trigger(data);
	};

	/** The scenarios this ViewModel listens to, unsubscribed for it on reset. */
	protected scenarioHandlers(): ILankaStatelessScenarioBinding<
		unknown,
		Actions & ILankaScenarioVM,
		TGateways,
		Services
	>[] {
		return [];
	}

	/** The actions the screen calls. Written against `this.set` and `this.get`. */
	protected abstract createActions(): Actions;

	/**
	 * The protected surface as an object, for the functional style.
	 *
	 * Assembled INSIDE the class because that is the only place `protected` can be
	 * read. Canon: `skills/parity/SKILL.md` section 3a.
	 */
	protected toStyleContext(): ILankaStatelessVMContext<
		Actions & ILankaScenarioVM,
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

	/** Builds the hook a screen calls. One ViewModel per call. */
	public build(): TLankaStatelessVMHook<Actions> {
		type TFullState = Actions & ILankaScenarioVM;

		lankaLogger.printViewModelLog("START Create slVM", this.name);

		let state = {} as TFullState;

		this.get = () => state;
		this.set = (partial, replace) => {
			const next =
				typeof partial === "function"
					? (partial as (current: TFullState) => TFullState)(state)
					: partial;

			state = replace ? (next as TFullState) : { ...state, ...next };
		};

		this.gateways = this.createGateways();
		this.services = this.createServices();

		const actions = this.createActions();
		const bindings = this.scenarioHandlers();

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

		state = { ...state, ...actions, initializeScenario, resetScenario };

		if (bindings.length > 0) {
			lankaScenarioBootstrap.registerViewModel(state, this.name);
		}

		const useStatelessViewModel = ((selector?: (full: TFullState) => unknown) =>
			selector ? selector(state) : state) as TLankaStatelessVMHook<Actions>;

		useStatelessViewModel.getState = () => state;

		lankaLogger.printViewModelLog("FINISH Create slVM", this.name);

		return useStatelessViewModel;
	}
}
