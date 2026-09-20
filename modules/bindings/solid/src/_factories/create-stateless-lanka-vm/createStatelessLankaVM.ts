import { createStatelessLankaVM as createCoreStatelessLankaVM } from "lanka/viewmodel";
import { toLankaCallableVM } from "../../_internal/to-lanka-callable-vm/toLankaCallableVM";
import type { TLankaStatelessVMConfig } from "lanka/viewmodel";
import type { TLankaSolidCallableVM } from "../../_internal/to-lanka-callable-vm/toLankaCallableVM";

export function createStatelessLankaVM<Actions extends object>(
	config: TLankaStatelessVMConfig<Actions, Record<string, never>, Record<string, never>>,
): TLankaSolidCallableVM<
	ReturnType<
		typeof createCoreStatelessLankaVM<Actions, Record<string, never>, Record<string, never>>
	>
>;

export function createStatelessLankaVM<Actions extends object, Services extends object>(
	config: TLankaStatelessVMConfig<Actions, Record<string, never>, Services>,
): TLankaSolidCallableVM<
	ReturnType<typeof createCoreStatelessLankaVM<Actions, Record<string, never>, Services>>
>;

export function createStatelessLankaVM<Actions extends object, TGateways extends object>(
	config: TLankaStatelessVMConfig<Actions, TGateways, Record<string, never>>,
): TLankaSolidCallableVM<
	ReturnType<typeof createCoreStatelessLankaVM<Actions, TGateways, Record<string, never>>>
>;

export function createStatelessLankaVM<
	Actions extends object,
	TGateways extends object,
	Services extends object,
>(
	config: TLankaStatelessVMConfig<Actions, TGateways, Services>,
): TLankaSolidCallableVM<
	ReturnType<typeof createCoreStatelessLankaVM<Actions, TGateways, Services>>
>;

/**
 * Orchestration with no reactive fields of its own, callable.
 *
 * A stateless ViewModel holds actions and nothing reactive, so the call answers
 * an accessor over the actions: `useImportVM()().run()` inside a component, and
 * `useImportVM.getState().run()` anywhere else, which is the spelling a
 * framework-free caller already uses.
 *
 * Why the name is core's name, and what the wrapper does not do, are on
 * `createLankaVM` in this bucket.
 */
export function createStatelessLankaVM<
	Actions extends object,
	TGateways extends object = Record<string, never>,
	Services extends object = Record<string, never>,
>(config: TLankaStatelessVMConfig<Actions, TGateways, Services>) {
	return toLankaCallableVM(createCoreStatelessLankaVM<Actions, TGateways, Services>(config));
}
