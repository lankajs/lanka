import { createLazySharedStoreLankaVM as createCoreLazySharedStoreLankaVM } from "lanka/viewmodel";
import { toLankaCallableVM } from "../../to-lanka-callable-vm/toLankaCallableVM";
import type { ALankaSharedStore, ILankaSharedStoreVMConfig } from "lanka/viewmodel";
import type { TLankaSvelteCallableVM } from "../../to-lanka-callable-vm/toLankaCallableVM";

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
): TLankaSvelteCallableVM<
	ReturnType<
		typeof createCoreLazySharedStoreLankaVM<
			StoreState,
			Actions,
			Store,
			Record<string, never>,
			Record<string, never>
		>
	>
>;

export function createLazySharedStoreLankaVM<
	StoreState extends object,
	Actions extends object,
	Store extends ALankaSharedStore<StoreState>,
	TGateways extends object,
>(
	config: ILankaSharedStoreVMConfig<StoreState, Actions, Store, TGateways, Record<string, never>>,
): TLankaSvelteCallableVM<
	ReturnType<
		typeof createCoreLazySharedStoreLankaVM<
			StoreState,
			Actions,
			Store,
			TGateways,
			Record<string, never>
		>
	>
>;

export function createLazySharedStoreLankaVM<
	StoreState extends object,
	Actions extends object,
	Store extends ALankaSharedStore<StoreState>,
	TGateways extends object,
	Services extends object,
>(
	config: ILankaSharedStoreVMConfig<StoreState, Actions, Store, TGateways, Services>,
): TLankaSvelteCallableVM<
	ReturnType<
		typeof createCoreLazySharedStoreLankaVM<StoreState, Actions, Store, TGateways, Services>
	>
>;

/**
 * The shared-store factory's lazy half, callable — and still lazy, for the
 * reason `createLazyLankaVM` in this bucket gives.
 *
 * Why the name is core's name, and what the wrapper does not do, are on
 * `createLankaVM` in this bucket.
 */
export function createLazySharedStoreLankaVM<
	StoreState extends object,
	Actions extends object,
	Store extends ALankaSharedStore<StoreState>,
	TGateways extends object = Record<string, never>,
	Services extends object = Record<string, never>,
>(config: ILankaSharedStoreVMConfig<StoreState, Actions, Store, TGateways, Services>) {
	return toLankaCallableVM(
		createCoreLazySharedStoreLankaVM<StoreState, Actions, Store, TGateways, Services>(config),
	);
}
