import { ALankaVMEnvironment } from "../lanka-vm-environment/ALankaVMEnvironment";
import { ILankaScenarioVM } from "../../../scenario/_interfaces/ILankaScenarioVM";
import { lankaScenarioBootstrap } from "../../../scenario/lanka-scenario-bootstrap/LankaScenarioBootstrap";
import { lankaLogger } from "../../../logger/lanka-logger/LankaLogger";
import { createLankaScenarioBinder } from "../../_internal/create-lanka-scenario-binder/createLankaScenarioBinder";
import type { ILankaScenario } from "../../../scenario/_interfaces/ILankaScenario";
import type { TLankaScenarioBindingsDeclaration } from "../../_types/TLankaScenarioBindingsDeclaration";
import type {
	ILankaStatelessScenarioBinding,
	ILankaStatelessVMContext,
	TLankaSetState,
} from "../../_factories/create-stateless-lanka-vm/createStatelessLankaVM";
import type { ILankaReadableVM } from "../../_interfaces/ILankaReadableVM";

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
 * `toLifecycleHooks` is protected too and is not one of these: it is how the
 * framework reads `onInit` and `onReset`, and a ViewModel overrides those,
 * never it.
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

	/**
	 * The scenarios this ViewModel listens to, unsubscribed for it on reset.
	 *
	 * Returning a FACTORY postpones building the list until bind time. See
	 * `TLankaScenarioBindingsDeclaration`.
	 */
	protected scenarioHandlers(): TLankaScenarioBindingsDeclaration<
		ILankaStatelessScenarioBinding<unknown, Actions & ILankaScenarioVM, TGateways, Services>
	> {
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

	/**
	 * Builds the ViewModel a screen reads. One per call.
	 *
	 * What comes back answers the read half of the port and nothing more: there
	 * is no store to write to from outside, because there is no state to write.
	 */
	public build(): ILankaReadableVM<Actions & ILankaScenarioVM> {
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

		const hooks = this.toLifecycleHooks();
		const { initializeScenario, resetScenario, needsBootstrap } = createLankaScenarioBinder({
			name: this.name,
			bindings: this.scenarioHandlers(),
			context: () => this.toStyleContext(),
			onInit: hooks.onInit,
			onReset: hooks.onReset,
		});

		state = { ...state, ...actions, initializeScenario, resetScenario };

		if (needsBootstrap) {
			lankaScenarioBootstrap.registerViewModel(state, this.name);
		}

		/**
		 * The port over a ViewModel with nothing that changes.
		 *
		 * `subscribe` returns an unsubscribe and never calls the listener, which is
		 * the honest implementation rather than a stub: a stateless ViewModel holds
		 * actions and no reactive fields, so there is no next state to report. That
		 * is what lets one binding serve all three shapes without asking which it
		 * was handed.
		 *
		 * `isAccessTracked` is false for the same reason — there are no keys whose
		 * reads could be worth recording, and a binding that tried would pay for a
		 * Proxy over an object that never moves.
		 */
		const statelessViewModel: ILankaReadableVM<TFullState> = {
			name: this.name,
			getState: () => state,
			subscribe: () => () => undefined,
			isAccessTracked: false,
		};

		lankaLogger.printViewModelLog("FINISH Create slVM", this.name);

		return statelessViewModel;
	}
}
