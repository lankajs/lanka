import { createStatelessLankaVM as createCoreStatelessLankaVM } from "lanka/viewmodel";
import { toLankaCallableVM } from "../../_internal/to-lanka-callable-vm/toLankaCallableVM";
import type { TLankaStatelessVMConfig } from "lanka/viewmodel";
import type { TLankaVueCallableVM } from "../../_internal/to-lanka-callable-vm/toLankaCallableVM";

export function createStatelessLankaVM<Actions extends object>(
	config: TLankaStatelessVMConfig<Actions, Record<string, never>, Record<string, never>>,
): TLankaVueCallableVM<
	ReturnType<
		typeof createCoreStatelessLankaVM<Actions, Record<string, never>, Record<string, never>>
	>
>;

export function createStatelessLankaVM<Actions extends object, Services extends object>(
	config: TLankaStatelessVMConfig<Actions, Record<string, never>, Services>,
): TLankaVueCallableVM<
	ReturnType<typeof createCoreStatelessLankaVM<Actions, Record<string, never>, Services>>
>;

export function createStatelessLankaVM<Actions extends object, TGateways extends object>(
	config: TLankaStatelessVMConfig<Actions, TGateways, Record<string, never>>,
): TLankaVueCallableVM<
	ReturnType<typeof createCoreStatelessLankaVM<Actions, TGateways, Record<string, never>>>
>;

export function createStatelessLankaVM<
	Actions extends object,
	TGateways extends object,
	Services extends object,
>(
	config: TLankaStatelessVMConfig<Actions, TGateways, Services>,
): TLankaVueCallableVM<ReturnType<typeof createCoreStatelessLankaVM<Actions, TGateways, Services>>>;

/**
 * Orchestration with no reactive fields of its own, callable.
 *
 * A stateless ViewModel holds actions and nothing else, so the call answers a
 * ref over the actions: `state.run` in a template, `state.value.run` in a
 * script. Most callers of one want neither — an orchestration is usually
 * triggered rather than rendered, and `useImportVM.getState().run()` needs no
 * component at all.
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
