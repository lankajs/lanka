import { createSharedStoreLankaVM as createCoreSharedStoreLankaVM } from "lanka/viewmodel";
import { toLankaCallableVM } from "../../to-lanka-callable-vm/toLankaCallableVM";
import type { ALankaSharedStore, ILankaSharedStoreVMConfig } from "lanka/viewmodel";
import type { TLankaSvelteCallableVM } from "../../to-lanka-callable-vm/toLankaCallableVM";

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
): TLankaSvelteCallableVM<
	ReturnType<
		typeof createCoreSharedStoreLankaVM<
			StoreState,
			Actions,
			Store,
			Record<string, never>,
			Record<string, never>
		>
	>
>;

export function createSharedStoreLankaVM<
	StoreState extends object,
	Actions extends object,
	Store extends ALankaSharedStore<StoreState>,
	Services extends object,
>(
	config: ILankaSharedStoreVMConfig<StoreState, Actions, Store, Record<string, never>, Services>,
): TLankaSvelteCallableVM<
	ReturnType<
		typeof createCoreSharedStoreLankaVM<
			StoreState,
			Actions,
			Store,
			Record<string, never>,
			Services
		>
	>
>;

export function createSharedStoreLankaVM<
	StoreState extends object,
	Actions extends object,
	Store extends ALankaSharedStore<StoreState>,
	TGateways extends object,
>(
	config: ILankaSharedStoreVMConfig<StoreState, Actions, Store, TGateways, Record<string, never>>,
): TLankaSvelteCallableVM<
	ReturnType<
		typeof createCoreSharedStoreLankaVM<
			StoreState,
			Actions,
			Store,
			TGateways,
			Record<string, never>
		>
	>
>;

export function createSharedStoreLankaVM<
	StoreState extends object,
	Actions extends object,
	Store extends ALankaSharedStore<StoreState>,
	TGateways extends object,
	Services extends object,
>(
	config: ILankaSharedStoreVMConfig<StoreState, Actions, Store, TGateways, Services>,
): TLankaSvelteCallableVM<
	ReturnType<typeof createCoreSharedStoreLankaVM<StoreState, Actions, Store, TGateways, Services>>
>;

/**
 * One feature split across several ViewModels over a common store, callable.
 *
 * Each ViewModel over the store gets its own callable and its own recording, and
 * the store underneath is the one core built — so two components reading two
 * ViewModels of one feature still see one state and one set of notifications.
 *
 * Why the name is core's name, and what the wrapper does not do, are on
 * `createLankaVM` in this bucket.
 */
export function createSharedStoreLankaVM<
	StoreState extends object,
	Actions extends object,
	Store extends ALankaSharedStore<StoreState>,
	TGateways extends object = Record<string, never>,
	Services extends object = Record<string, never>,
>(config: ILankaSharedStoreVMConfig<StoreState, Actions, Store, TGateways, Services>) {
	return toLankaCallableVM(
		createCoreSharedStoreLankaVM<StoreState, Actions, Store, TGateways, Services>(config),
	);
}
