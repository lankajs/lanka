import { ILankaScenarioVM } from "../../../scenario/_interfaces/ILankaScenarioVM";
import { ALankaSharedStore } from "../../_abstractions/lanka-shared-store/ALankaSharedStore";
import { createLazyLankaHook } from "../../_internal/create-lazy-lanka-hook/createLazyLankaHook";
import { createSharedStoreLankaVM } from "../create-shared-store-lanka-vm/createSharedStoreLankaVM";
import type { ILankaSharedStoreVMConfig } from "../../_interfaces/ILankaSharedStoreVMConfig";

/**
 * What a lazy shared-store ViewModel is, in the type as well as at runtime.
 *
 * The overloads used to promise the eager factory's return and nothing else, so
 * `dispose` and `getStoreState` existed on the object and not in the type: a
 * consumer releasing a closed screen's ViewModel got a compile error for calling
 * something that was there.
 */
type TLazySharedStoreReturn<
	StoreState extends object,
	Actions extends object,
	Store extends ALankaSharedStore<StoreState>,
	TGateways extends object,
	Services extends object,
> = ReturnType<typeof createSharedStoreLankaVM<StoreState, Actions, Store, TGateways, Services>> & {
	getState: () => StoreState & Actions & ILankaScenarioVM;
	getStoreState: () => StoreState;
	dispose: () => void;
};

export function createLazySharedStoreLankaVM<
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
): TLazySharedStoreReturn<StoreState, Actions, Store, Record<string, never>, Record<string, never>>;

export function createLazySharedStoreLankaVM<
	StoreState extends object,
	Actions extends object,
	Store extends ALankaSharedStore<StoreState>,
	TGateways extends object,
>(
	config: ILankaSharedStoreVMConfig<StoreState, Actions, Store, TGateways, Record<string, never>>,
): TLazySharedStoreReturn<StoreState, Actions, Store, TGateways, Record<string, never>>;

export function createLazySharedStoreLankaVM<
	StoreState extends object,
	Actions extends object,
	Store extends ALankaSharedStore<StoreState>,
	TGateways extends object,
	Services extends object,
>(
	config: ILankaSharedStoreVMConfig<StoreState, Actions, Store, TGateways, Services>,
): TLazySharedStoreReturn<StoreState, Actions, Store, TGateways, Services>;

/**
 * The lazy `createSharedStoreLankaVM`: nothing is built until a screen asks.
 *
 * The mechanism is `createLazyLankaHook`; this file is the one line that says
 * which ViewModel gets built. `dispose` releases THIS ViewModel's scenario
 * subscriptions and never the shared store — the store is shared, other
 * ViewModels stand on it, and taking its state away is not this one's decision.
 * That is the hook's behaviour, not a special case here: it resets the scenario
 * and drops its reference, and a shared store outlives both.
 */
export function createLazySharedStoreLankaVM<
	StoreState extends object,
	Actions extends object,
	Store extends ALankaSharedStore<StoreState>,
	TGateways extends object = Record<string, never>,
	Services extends object = Record<string, never>,
>(config: ILankaSharedStoreVMConfig<StoreState, Actions, Store, TGateways, Services>) {
	return createLazyLankaHook({
		name: config.name,
		kind: "ssVM",
		create: () => createSharedStoreLankaVM(config),
	});
}
