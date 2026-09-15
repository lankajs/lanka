import type { ILankaSharedStoreVM } from "../../_interfaces/ILankaSharedStoreVMConfig";
import { resolveLankaDependency } from "../../_utils/resolve-lanka-dependency/resolveLankaDependency";
import { createLankaScenarioBinder } from "../../_internal/create-lanka-scenario-binder/createLankaScenarioBinder";

import { ILankaScenarioVM } from "../../../scenario/_interfaces/ILankaScenarioVM";
import { lankaScenarioBootstrap } from "../../../scenario/lanka-scenario-bootstrap/LankaScenarioBootstrap";
import { lankaLogger } from "../../../logger/lanka-logger/LankaLogger";
import type { ILankaSharedStoreVMConfig } from "../../_interfaces/ILankaSharedStoreVMConfig";
import type { ILankaSharedStoreVMContext } from "../../_interfaces/ILankaSharedStoreVMContext";
import { ALankaSharedStore } from "../../_abstractions/lanka-shared-store/ALankaSharedStore";

/**
 * Factory for ViewModels backed by an external shared store instance.
 * Multiple ViewModels can be created on top of the same store instance.
 */
export function createSharedStoreLankaVM<
	StoreState extends object,
	Actions extends object,
	Store extends ALankaSharedStore<StoreState>,
>(
	config: ILankaSharedStoreVMConfig<
		StoreState,
		Actions,
		Store,
		Record<string, never>,
		Record<string, never>
	>,
): ILankaSharedStoreVM<StoreState, Actions>;

export function createSharedStoreLankaVM<
	StoreState extends object,
	Actions extends object,
	Store extends ALankaSharedStore<StoreState>,
	Services extends object,
>(
	config: ILankaSharedStoreVMConfig<StoreState, Actions, Store, Record<string, never>, Services>,
): ILankaSharedStoreVM<StoreState, Actions>;

export function createSharedStoreLankaVM<
	StoreState extends object,
	Actions extends object,
	Store extends ALankaSharedStore<StoreState>,
	TGateways extends object,
>(
	config: ILankaSharedStoreVMConfig<StoreState, Actions, Store, TGateways, Record<string, never>>,
): ILankaSharedStoreVM<StoreState, Actions>;

export function createSharedStoreLankaVM<
	StoreState extends object,
	Actions extends object,
	Store extends ALankaSharedStore<StoreState>,
	TGateways extends object,
	Services extends object,
>(
	config: ILankaSharedStoreVMConfig<StoreState, Actions, Store, TGateways, Services>,
): ILankaSharedStoreVM<StoreState, Actions>;

export function createSharedStoreLankaVM<
	StoreState extends object,
	Actions extends object,
	Store extends ALankaSharedStore<StoreState>,
	TGateways extends object = Record<string, never>,
	Services extends object = Record<string, never>,
>(config: ILankaSharedStoreVMConfig<StoreState, Actions, Store, TGateways, Services>) {
	lankaLogger.printViewModelLog("START Create ssVM", config.name);

	type TFullState = StoreState & Actions & ILankaScenarioVM;

	/**
	 * Unsubscribe functions, plus the event types already subscribed to.
	 *
	 * Two separate jobs, kept separate: the array releases subscriptions, the set
	 * prevents subscribing to one event type twice.
	 */
	let actions = {} as Actions;

	const gateways = resolveLankaDependency(config.gateways);
	const services = resolveLankaDependency(config.services);

	let lastStoreStateRef: StoreState | null = null;
	let lastFullStateRef: TFullState | null = null;

	const buildFullState = (storeState: StoreState): TFullState => {
		if (lastStoreStateRef === storeState && lastFullStateRef) {
			return lastFullStateRef;
		}

		lastStoreStateRef = storeState;
		lastFullStateRef = {
			...storeState,
			...actions,
			initializeScenario,
			resetScenario,
		};

		return lastFullStateRef;
	};

	const getFullState = (): TFullState => buildFullState(config.store.getState());

	const ctx: ILankaSharedStoreVMContext<StoreState, TFullState, Store, TGateways, Services> = {
		set: (partial, replace) => config.store.setState(partial, replace),
		getStore: () => config.store.getState(),
		get: () => getFullState(),
		store: config.store,
		gateways,
		services,
		trigger: (scenario, data) => scenario.trigger(data),
	};

	const { initializeScenario, resetScenario, needsBootstrap } = createLankaScenarioBinder({
		name: config.name,
		bindings: config.scenarioHandlers,
		context: () => ctx,
		onInit: config.onInit,
		onReset: config.onReset,
	});

	actions = config.createActions(ctx);
	lastStoreStateRef = null;
	lastFullStateRef = null;
	const isAccessTrackingEnabled = config.enableAccessTrackingOptimization ?? true;

	/**
	 * The port over a slice of somebody else's store.
	 *
	 * `subscribe` is where the SHAPING happens — the store reports its own slice,
	 * and both states are composed into full shape before a listener sees them.
	 * Doing it here rather than in a binding is what lets one binding serve this
	 * shape and the plain one without knowing which it was handed.
	 *
	 * Two ViewModels over one store therefore each hear every change to it, and
	 * each decides for itself — through its reader's access tracking — whether the
	 * change is worth a render.
	 */
	const sharedStoreViewModel: ILankaSharedStoreVM<StoreState, Actions> = {
		name: config.name,
		getState: getFullState,
		getStoreState: () => config.store.getState(),
		isAccessTracked: isAccessTrackingEnabled,
		subscribe: (listener) =>
			config.store.subscribe((storeState, prevStoreState) => {
				listener(buildFullState(storeState), buildFullState(prevStoreState));
			}),
	};

	if (needsBootstrap) {
		const scenarioViewModel: ILankaScenarioVM = {
			initializeScenario,
			resetScenario,
		};
		lankaScenarioBootstrap.registerViewModel(scenarioViewModel, config.name);
	}

	lankaLogger.printViewModelLog("FINISH Create ssVM", config.name);

	return sharedStoreViewModel;
}
