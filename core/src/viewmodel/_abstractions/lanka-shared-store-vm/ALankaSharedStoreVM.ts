import { ALankaVMEnvironment } from "../lanka-vm-environment/ALankaVMEnvironment";
import { createSharedStoreLankaVM } from "../../_factories/create-shared-store-lanka-vm/createSharedStoreLankaVM";
import type { ALankaSharedStore } from "../lanka-shared-store/ALankaSharedStore";
import type { ILankaScenarioVM } from "../../../scenario/_interfaces/ILankaScenarioVM";
import type { ILankaSharedStoreVMContext } from "../../_interfaces/ILankaSharedStoreVMContext";
import type {
	ILankaSharedStoreScenarioBinding,
	TLankaSharedStoreVMHook,
} from "../../_interfaces/ILankaSharedStoreVMConfig";

/**
 * A ViewModel over a store several ViewModels share, written as a class.
 *
 * The third rung of the ladder in `core/README.md`: reach for it only when two
 * ViewModels must CO-EDIT one state — a list and the badge that counts it, a
 * form and the header that says it is dirty. What the class adds over the
 * stateful base is where the state lives: in the store it is given, so `set`
 * writes there and `getStore` reads it.
 *
 * ```ts
 * class BadgeVM extends ALankaSharedStoreVM<ISelection, IBadgeActions, TodoStore> {
 * 	protected readonly name = "BadgeVM";
 *
 * 	public constructor(store: TodoStore) {
 * 		super(store);
 * 	}
 *
 * 	protected createActions(): IBadgeActions {
 * 		return { clear: () => this.set({ selectedId: null }) };
 * 	}
 * }
 * ```
 *
 * Unlike its two siblings this one is a thin adapter rather than the
 * implementation: the store, the tracked hook and the two memoised state
 * references are the factory's, and duplicating them here would be the second
 * implementation the parity canon exists to prevent. What it gives a class-style
 * consumer is the same protected surface under the same names.
 *
 * Canon: `skills/parity/SKILL.md`.
 */
export abstract class ALankaSharedStoreVM<
	StoreState extends object,
	Actions extends object,
	Store extends ALankaSharedStore<StoreState>,
	TGateways extends object = Record<string, never>,
	Services extends object = Record<string, never>,
> extends ALankaVMEnvironment<TGateways, Services> {
	/** Names the ViewModel in the logs and in the scenario registry. */
	protected abstract readonly name: string;

	/** The store this ViewModel and its siblings share. */
	protected readonly store: Store;

	/** Writes into the shared store, which every reader of it hears about. */
	protected set!: ILankaSharedStoreVMContext<
		StoreState,
		StoreState & Actions & ILankaScenarioVM,
		Store,
		TGateways,
		Services
	>["set"];

	/** Reads the store's own state, without this ViewModel's actions on top. */
	protected getStore!: () => StoreState;

	/** Reads the store's state WITH the actions, which is what a screen sees. */
	protected get!: () => StoreState & Actions & ILankaScenarioVM;

	/** Fires a scenario, which every ViewModel bound to it then hears. */
	protected trigger!: ILankaSharedStoreVMContext<
		StoreState,
		StoreState & Actions & ILankaScenarioVM,
		Store,
		TGateways,
		Services
	>["trigger"];

	public constructor(store: Store) {
		super();
		this.store = store;
	}

	/**
	 * Turn off when one broad consumer reads most fields of the store — proxy
	 * tracking then costs more than it saves.
	 */
	protected readonly enableAccessTrackingOptimization: boolean = true;

	/** The scenarios this ViewModel listens to, unsubscribed for it on reset. */
	protected scenarioHandlers(): ILankaSharedStoreScenarioBinding<
		unknown,
		StoreState,
		Actions,
		Store,
		TGateways,
		Services
	>[] {
		return [];
	}

	/** The actions the screen calls. Written against `this.set` and `this.get`. */
	protected abstract createActions(): Actions;

	/** Builds the hook a screen calls. One ViewModel per call. */
	public build(): TLankaSharedStoreVMHook<StoreState, Actions> {
		return createSharedStoreLankaVM<StoreState, Actions, Store, TGateways, Services>({
			name: this.name,
			store: this.store,
			enableAccessTrackingOptimization: this.enableAccessTrackingOptimization,
			gateways: () => this.createGateways(),
			services: () => this.createServices(),
			scenarioHandlers: this.scenarioHandlers(),
			createActions: (context) => {
				// The context arrives here and becomes the protected surface, under the
				// same names it carries: a consumer who switches styles moves the same
				// call from `set(...)` to `this.set(...)` and changes nothing else.
				this.set = context.set;
				this.getStore = context.getStore;
				this.get = context.get;
				this.gateways = context.gateways;
				this.services = context.services;
				this.trigger = context.trigger;

				return this.createActions();
			},
			onInit: () => {
				this.onInit();
			},
			onReset: () => {
				this.onReset();
			},
		});
	}
}
