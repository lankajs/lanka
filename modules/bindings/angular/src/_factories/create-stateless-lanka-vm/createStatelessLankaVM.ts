import { createStatelessLankaVM as createCoreStatelessLankaVM } from "lanka/viewmodel";
import { toLankaCallableVM } from "../../to-lanka-callable-vm/toLankaCallableVM";
import type { TLankaStatelessVMConfig } from "lanka/viewmodel";
import type { TLankaAngularCallableVM } from "../../to-lanka-callable-vm/toLankaCallableVM";

export function createStatelessLankaVM<Actions extends object>(
	config: TLankaStatelessVMConfig<Actions, Record<string, never>, Record<string, never>>,
): TLankaAngularCallableVM<
	ReturnType<
		typeof createCoreStatelessLankaVM<Actions, Record<string, never>, Record<string, never>>
	>
>;

export function createStatelessLankaVM<Actions extends object, Services extends object>(
	config: TLankaStatelessVMConfig<Actions, Record<string, never>, Services>,
): TLankaAngularCallableVM<
	ReturnType<typeof createCoreStatelessLankaVM<Actions, Record<string, never>, Services>>
>;

export function createStatelessLankaVM<Actions extends object, TGateways extends object>(
	config: TLankaStatelessVMConfig<Actions, TGateways, Record<string, never>>,
): TLankaAngularCallableVM<
	ReturnType<typeof createCoreStatelessLankaVM<Actions, TGateways, Record<string, never>>>
>;

export function createStatelessLankaVM<
	Actions extends object,
	TGateways extends object,
	Services extends object,
>(
	config: TLankaStatelessVMConfig<Actions, TGateways, Services>,
): TLankaAngularCallableVM<
	ReturnType<typeof createCoreStatelessLankaVM<Actions, TGateways, Services>>
>;

/**
 * Orchestration with no reactive fields of its own, callable.
 *
 * A stateless ViewModel holds actions, so the call answers a `Signal` over the
 * actions — and `importVM.getState().run()` outside a component is the spelling
 * that needs no injection context at all, which is usually the one an
 * orchestration ViewModel wants.
 *
 * Why the name is core's name, why the declaration needs no injection context,
 * and what the wrapper does not do, are on `createLankaVM` in this bucket.
 */
export function createStatelessLankaVM<
	Actions extends object,
	TGateways extends object = Record<string, never>,
	Services extends object = Record<string, never>,
>(config: TLankaStatelessVMConfig<Actions, TGateways, Services>) {
	return toLankaCallableVM(createCoreStatelessLankaVM<Actions, TGateways, Services>(config));
}
